"use client";

import { AlertCircle, AlertTriangle, Check, Loader2, Play } from "lucide-react";
import Script from "next/script";
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
import { Progress } from "@/components/ui/progress";

export function ImportTriggerCard() {
  const [isRunning, setIsRunning] = useState(false);
  const [musicKitReady, setMusicKitReady] = useState(false);
  const [progress, setProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    message?: string;
  } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  async function handleStart() {
    setIsRunning(true);
    setSummary(null);
    setErrorLine(null);
    setProgress({
      stage: "auth",
      current: 0,
      total: 0,
      message: "Connecting to Apple Music...",
    });

    try {
      // Step 1: Fetch developer token from admin-only GET route
      const tokenRes = await fetch("/api/apple-token");
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        if (tokenRes.status === 401) {
          toast.error("Your session expired. Please sign in again.");
        } else if (tokenRes.status === 403) {
          toast.error("Only admins can trigger imports.");
        } else {
          toast.error(
            (body as { error?: string }).error ??
              `Request failed (${tokenRes.status}).`,
          );
        }
        return;
      }
      const { token } = (await tokenRes.json()) as { token: string };

      // Step 2: Configure MusicKit with the developer token
      window.MusicKit.configure({
        developerToken: token,
        app: { name: "Warwick Massive Tunage", build: "1.0" },
      });

      // Step 3: Authorize — MUST be inside onClick handler (user gesture required, Pitfall 7)
      const musicUserToken = await window.MusicKit.getInstance().authorize();

      // Step 4: POST to /api/import and read SSE stream
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicUserToken }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          toast.error("Your session expired. Please sign in again.");
        } else if (res.status === 403) {
          toast.error("Only admins can trigger imports.");
        } else {
          toast.error(
            (body as { error?: string }).error ??
              `Request failed (${res.status}).`,
          );
        }
        return;
      }

      if (!res.body) {
        toast.error("Import failed. No response stream received.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Split on SSE event delimiter (double newline)
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const event = JSON.parse(part.slice(6)) as {
            type: string;
            stage?: string;
            current?: number;
            total?: number;
            message?: string;
            sessions?: number;
            tracks?: number;
            errors?: number;
          };

          if (event.type === "progress") {
            setProgress({
              stage: event.stage ?? "",
              current: event.current ?? 0,
              total: event.total ?? 0,
              message: event.message,
            });
          } else if (event.type === "complete") {
            setProgress(null);
            setSummary(
              `${event.sessions} sessions imported, ${event.tracks} tracks stored.`,
            );
            toast.success("Import complete");
          } else if (event.type === "error") {
            setErrorLine(event.message ?? "Unknown error");
            toast.error(event.message ?? "Import failed");
          }
        }
      }
    } catch (_err) {
      toast.error(
        "Import failed. Could not reach the import endpoint. Check your connection and retry.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <>
      {/* MusicKit JS v3 CDN — loaded after interactive, sets window.MusicKit */}
      <Script
        src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"
        strategy="afterInteractive"
        onLoad={() => setMusicKitReady(true)}
      />
      <Card>
        <CardHeader>
          <CardTitle>Sync sessions</CardTitle>
          <CardDescription>
            Fetch all sessions and tracks from the streaming platforms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="default"
            size="default"
            disabled={isRunning || !musicKitReady}
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

          {/* D-04 replace-all warning — ALWAYS visible, informs admin before clicking */}
          <p className="flex items-start gap-2 text-sm text-amber-500/90">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Re-importing will overwrite all manually entered dates and
              contributor assignments.
            </span>
          </p>

          {/* Progress bar + status line — shown while import is running */}
          {progress && (
            <div className="space-y-2">
              <Progress
                value={
                  progress.total > 0
                    ? Math.round((progress.current / progress.total) * 100)
                    : 0
                }
                className="h-2"
              />
              <p className="text-sm text-muted-foreground">
                {progress.message ?? `Stage: ${progress.stage}`}
              </p>
            </div>
          )}

          {/* Completion summary — shown after successful import */}
          {summary && (
            <p className="text-sm text-muted-foreground flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-500" />
              {summary}
            </p>
          )}

          {/* Error line — shown when import fails */}
          {errorLine && (
            <p className="text-sm text-destructive flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              {errorLine}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
