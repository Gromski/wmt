"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AttributionErrorRow {
  id: number;
  sessionNumber: number;
  theme: string;
}

export interface ContributorOption {
  initials: string;
  name: string;
}

const SLOT_LABELS = [
  "Tracks 1–4",
  "Tracks 5–8",
  "Tracks 9–12",
  "Tracks 13–16",
] as const;

export function AttributionErrorCard({
  errors,
  contributors,
}: {
  errors: AttributionErrorRow[];
  contributors: ContributorOption[];
}) {
  const [slots, setSlots] = useState<
    Record<number, [string, string, string, string]>
  >({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const visible = errors.filter((e) => !hiddenIds.has(e.id));
  if (visible.length === 0) return null;

  function picksFor(id: number): [string, string, string, string] {
    return slots[id] ?? ["", "", "", ""];
  }

  function setPick(id: number, slot: number, value: string) {
    setSlots((prev) => {
      const current = picksFor(id);
      const next = [...current] as [string, string, string, string];
      next[slot] = value;
      return { ...prev, [id]: next };
    });
  }

  function canSave(id: number) {
    const p = picksFor(id);
    return p.every((s) => s !== "") && new Set(p).size === 4;
  }

  async function save(id: number, sessionNumber: number) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/sessions/${id}/attribution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initials: picksFor(id) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          toast.error("Your session expired. Please sign in again.");
        } else if (res.status === 403) {
          toast.error("Only admins can save attribution.");
        } else {
          toast.error(
            (body as { error?: string }).error ??
              `Could not save attribution for Session ${sessionNumber} — try again.`,
          );
        }
        return;
      }
      toast.success(`Attribution saved for Session ${sessionNumber}.`);
      // Collapse the session row after 2s grace period per UI-SPEC §Interaction States
      setTimeout(() => setHiddenIds((prev) => new Set(prev).add(id)), 2000);
    } catch {
      toast.error(
        `Could not save attribution for Session ${sessionNumber} — try again.`,
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Alert
      className="border-l-4"
      style={{
        borderLeftColor: "#b45309",
        backgroundColor: "oklch(0.145 0 0 / 40%)",
      }}
    >
      <AlertCircle className="h-4 w-4" style={{ color: "#fbbf24" }} />
      <AlertTitle>{visible.length} sessions need manual attribution</AlertTitle>
      <AlertDescription>
        These sessions did not contain a recognisable initials string. Assign
        contributor order manually.
      </AlertDescription>
      <div className="mt-4 space-y-6">
        {visible.map((e) => {
          const picks = picksFor(e.id);
          return (
            <div
              key={e.id}
              className="rounded-md border p-4"
              style={{ borderColor: "rgba(180, 83, 9, 0.4)" }}
            >
              <p className="text-sm font-semibold">
                Session {e.sessionNumber} &mdash; &ldquo;{e.theme}&rdquo;
              </p>
              <div className="mt-3 space-y-2">
                {SLOT_LABELS.map((label, slot) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-[110px] shrink-0 text-sm text-muted-foreground">
                      {label}:
                    </span>
                    <Select
                      value={picks[slot]}
                      onValueChange={(v) => setPick(e.id, slot, v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select person…" />
                      </SelectTrigger>
                      <SelectContent>
                        {contributors.map((c) => (
                          <SelectItem key={c.initials} value={c.initials}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button
                className="mt-4 w-full"
                disabled={!canSave(e.id) || savingId === e.id}
                onClick={() => save(e.id, e.sessionNumber)}
                aria-busy={savingId === e.id}
              >
                {savingId === e.id ? "Saving…" : "Save attribution"}
              </Button>
            </div>
          );
        })}
      </div>
    </Alert>
  );
}
