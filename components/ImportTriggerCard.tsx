"use client";

import { Loader2, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ImportTriggerCard() {
  const [isRunning, setIsRunning] = useState(false);

  async function handleStart() {
    setIsRunning(true);
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 202) {
        toast.success(body.message ?? "Import queued");
      } else if (res.status === 401) {
        toast.error("Your session expired. Please sign in again.");
      } else if (res.status === 403) {
        toast.error("Only admins can trigger imports.");
      } else {
        toast.error(body.error ?? `Import request failed (${res.status}).`);
      }
    } catch (_err) {
      toast.error(
        "Could not reach the import endpoint. Check your connection and retry.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync sessions</CardTitle>
        <CardDescription>
          Fetch all sessions and tracks from the streaming platforms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="default"
          size="default"
          disabled={isRunning}
          onClick={handleStart}
          aria-busy={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start import
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
