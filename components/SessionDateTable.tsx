"use client";

import { AlertCircle, Check } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SessionDateRow {
  id: number;
  sessionNumber: number;
  theme: string;
  date: number | null; // timestamp_ms stored as number from DB
}

type RowState = "default" | "saving" | "saved" | "error";

export function SessionDateTable({ rows }: { rows: SessionDateRow[] }) {
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      ]),
    ),
  );
  const [states, setStates] = useState<Record<number, RowState>>({});

  async function saveRow(id: number) {
    const v = values[id] ?? "";
    setStates((s) => ({ ...s, [id]: "saving" }));
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: v === "" ? null : v }),
      });
      if (!res.ok) {
        setStates((s) => ({ ...s, [id]: "error" }));
        // Inline error only — no toast per row to avoid noise per UI-SPEC
        return;
      }
      setStates((s) => ({ ...s, [id]: "saved" }));
      setTimeout(() => setStates((s) => ({ ...s, [id]: "default" })), 1500);
    } catch {
      setStates((s) => ({ ...s, [id]: "error" }));
    }
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session dates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No sessions yet. Run &lsquo;Start import&rsquo; above to populate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Session dates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] text-right">No.</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead className="w-[160px]">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const state = states[r.id] ?? "default";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-right text-muted-foreground">
                      {r.sessionNumber}
                    </TableCell>
                    <TableCell className="truncate max-w-0">
                      {r.theme}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={values[r.id] ?? ""}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                          onBlur={() => saveRow(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              (e.target as HTMLInputElement).blur();
                          }}
                          disabled={state === "saving"}
                          placeholder="Pick a date"
                          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${state === "error" ? "border-destructive" : "border-input"} ${state === "saving" ? "opacity-50 cursor-wait" : ""}`}
                        />
                        {state === "saved" && (
                          <Check className="h-4 w-4 shrink-0 text-green-500" />
                        )}
                        {state === "error" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Could not save date — try again
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
