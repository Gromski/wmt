import { headers } from "next/headers";

import * as schema from "@/db/schema";
import { generateAppleDeveloperToken } from "@/lib/apple-dev-token";
import {
  type AppleLibrarySong,
  fetchAllLibraryPlaylists,
  fetchPlaylistTracks,
} from "@/lib/apple-music-client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchArtistTags } from "@/lib/lastfm-client";
import {
  KNOWN_CONTRIBUTORS,
  parsePlaylistDescription,
  SESSION_PLAYLIST_RE,
} from "@/lib/parse-playlist";

export const maxDuration = 300; // Explicit — matches Vercel Hobby default (RESEARCH §State of the Art)

/**
 * In-memory representation of a fully built import plan.
 * Assembled entirely from Apple Music API data before any DB writes begin (D-04).
 */
interface ImportPlan {
  sessionPlans: Array<{
    sessionNumber: number;
    theme: string;
    description: string | null;
    appleMusicPlaylistId: string;
    attributionParsed: boolean; // false when parsed.initials === null (IMPORT-08)
    initials: [string, string, string, string] | null;
    tracks: Array<{
      position: number; // 1..16
      title: string;
      artistName: string;
      albumName: string | null;
      releaseYear: number | null;
      durationMs: number | null;
      isrc: string | null;
      appleId: string | null;
      youtubeUrl: string | null;
    }>;
  }>;
  skippedPlaylistNames: string[]; // unmatched names — logged for OQ-1 follow-up
  fetchErrors: number; // per-playlist fetch failures
}

export async function POST(request: Request) {
  // Auth gate — preserved verbatim from Phase 1 (session check before body parse)
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse + validate Music User Token
  const { musicUserToken } = (await request.json()) as {
    musicUserToken?: string;
  };

  if (!musicUserToken) {
    return Response.json({ error: "Missing musicUserToken" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // ── Build phase ────────────────────────────────────────────────────
        const devToken = await generateAppleDeveloperToken();

        send({
          type: "progress",
          stage: "playlists",
          current: 0,
          total: 0,
          message: "Listing library playlists...",
        });

        const allPlaylists = await fetchAllLibraryPlaylists(
          devToken,
          musicUserToken,
        );

        // Filter to session playlists ("Warwick Massive Tunage N" naming convention — Open Question 1 refinement)
        const skippedPlaylistNames: string[] = [];
        const sessionPlaylists = allPlaylists.filter((p) => {
          const name = p.attributes?.name ?? "";
          if (SESSION_PLAYLIST_RE.test(name)) return true;
          console.log("[import] skipped playlist:", name);
          skippedPlaylistNames.push(name);
          return false;
        });

        send({
          type: "progress",
          stage: "playlists",
          current: 0,
          total: sessionPlaylists.length,
        });

        const plan: ImportPlan = {
          sessionPlans: [],
          skippedPlaylistNames,
          fetchErrors: 0,
        };

        // Fetch tracks for each session playlist sequentially
        for (let i = 0; i < sessionPlaylists.length; i++) {
          const p = sessionPlaylists[i];
          const name = p.attributes?.name ?? "";

          send({
            type: "progress",
            stage: "tracks",
            current: i + 1,
            total: sessionPlaylists.length,
            message: `Fetching tracks for ${name}...`,
          });

          let items: AppleLibrarySong[];
          try {
            items = await fetchPlaylistTracks(p.id, devToken, musicUserToken);
          } catch (fetchErr) {
            plan.fetchErrors++;
            console.error(
              `[import] Failed to fetch tracks for "${name}":`,
              String(fetchErr),
            );
            send({
              type: "progress",
              stage: "tracks",
              current: i + 1,
              total: sessionPlaylists.length,
              message: `Skipping ${name} (API error)`,
            });
            continue; // do not abort the loop — robustness per RESEARCH §System Architecture
          }

          const parsed = parsePlaylistDescription(
            name,
            p.attributes?.description?.standard,
          );

          // Build track records for positions 1..N (up to 16 tracks per playlist)
          // youtubeUrl is parsed at the session level (from the description) — write it
          // onto the fallback track: the first track without an appleId, or position 1
          // if every track has an appleId (simplest safe rule per PATTERNS.md).
          const fallbackIdx = items.findIndex(
            (item) => !item.relationships?.catalog?.data?.[0]?.id,
          );
          const youtubeUrlTargetIdx = fallbackIdx === -1 ? 0 : fallbackIdx;

          const tracks: ImportPlan["sessionPlans"][0]["tracks"] = items
            .slice(0, 16)
            .map((item, idx) => {
              const catalogItem = item.relationships?.catalog?.data?.[0];
              const releaseDate = catalogItem?.attributes?.releaseDate;
              const releaseYear = releaseDate
                ? Number(releaseDate.slice(0, 4)) || null
                : null;

              return {
                position: idx + 1,
                title: item.attributes.name,
                artistName: item.attributes.artistName,
                albumName: item.attributes.albumName ?? null,
                durationMs: item.attributes.durationInMillis ?? null,
                appleId: catalogItem?.id ?? null,
                isrc: catalogItem?.attributes?.isrc ?? null,
                releaseYear,
                youtubeUrl:
                  idx === youtubeUrlTargetIdx ? parsed.youtubeUrl : null,
              };
            });

          // Determine attribution: round-robin — initials[(position - 1) % 4]
          // pos 1→initials[0], 2→initials[1], 3→initials[2], 4→initials[3], 5→initials[0], …
          const attributionParsed = parsed.initials !== null;
          const initials =
            parsed.initials !== null
              ? (parsed.initials as [string, string, string, string])
              : null;

          plan.sessionPlans.push({
            sessionNumber: parsed.sessionNumber,
            theme: parsed.theme,
            description: p.attributes?.description?.standard ?? null,
            appleMusicPlaylistId: p.id,
            attributionParsed,
            initials,
            tracks,
          });
        }

        // Emit structural marker so DB write phase can proceed
        send({
          type: "progress",
          stage: "ready-to-write",
          current: plan.sessionPlans.length,
          total: plan.sessionPlans.length,
          message: `Plan built, ${plan.sessionPlans.length} sessions ready for DB write`,
        });

        // ── DB write phase ─────────────────────────────────────────────────
        // Replace-all (D-04): delete child tables first, then parents
        await db.batch([
          db.delete(schema.artistTags),
          db.delete(schema.sessionTracks),
          db.delete(schema.tracks),
          db.delete(schema.sessions),
        ]);

        // Upsert the four canonical contributors (never deleted)
        const contributorRows = Object.entries(KNOWN_CONTRIBUTORS).map(
          ([initials, name]) => ({ initials, name }),
        );
        await db
          .insert(schema.contributors)
          .values(contributorRows)
          .onConflictDoNothing();

        const insertedContribs = await db.select().from(schema.contributors);
        const contribIdByInitials = new Map(
          insertedContribs.map((c) => [c.initials, c.id]),
        );

        // Insert sessions
        const sessionRows = plan.sessionPlans.map((sp) => ({
          sessionNumber: sp.sessionNumber,
          theme: sp.theme,
          description: sp.description,
          appleMusicPlaylistId: sp.appleMusicPlaylistId,
          attributionParsed: sp.attributionParsed,
        }));

        let insertedSessions: { id: number }[] = [];
        if (sessionRows.length > 0) {
          insertedSessions = await db
            .insert(schema.sessions)
            .values(sessionRows)
            .returning({ id: schema.sessions.id });
        }

        // Insert tracks (flattened, tracking session+position for sessionTracks)
        interface TrackMeta {
          planSessionIndex: number;
          position: number;
        }
        const trackRows: (typeof schema.tracks.$inferInsert)[] = [];
        const trackMeta: TrackMeta[] = [];

        for (
          let sessionIdx = 0;
          sessionIdx < plan.sessionPlans.length;
          sessionIdx++
        ) {
          for (const track of plan.sessionPlans[sessionIdx].tracks) {
            trackRows.push({
              appleId: track.appleId ?? undefined,
              title: track.title,
              artistName: track.artistName,
              albumName: track.albumName ?? undefined,
              releaseYear: track.releaseYear ?? undefined,
              durationMs: track.durationMs ?? undefined,
              isrc: track.isrc ?? undefined,
              youtubeUrl: track.youtubeUrl ?? undefined,
            });
            trackMeta.push({
              planSessionIndex: sessionIdx,
              position: track.position,
            });
          }
        }

        let insertedTracks: { id: number }[] = [];
        if (trackRows.length > 0) {
          insertedTracks = await db
            .insert(schema.tracks)
            .values(trackRows)
            .returning({ id: schema.tracks.id });
        }

        // Build session_tracks join rows
        const sessionTrackRows: (typeof schema.sessionTracks.$inferInsert)[] =
          [];
        for (let flatIdx = 0; flatIdx < insertedTracks.length; flatIdx++) {
          const { planSessionIndex, position } = trackMeta[flatIdx];
          const sessionPlan = plan.sessionPlans[planSessionIndex];
          const sessionId = insertedSessions[planSessionIndex]?.id;

          if (sessionId === undefined) continue;

          let attributedContributorId: number | null = null;
          if (sessionPlan.attributionParsed && sessionPlan.initials) {
            const slot = (position - 1) % 4;
            const contribInitials = sessionPlan.initials[slot];
            attributedContributorId =
              contribIdByInitials.get(contribInitials) ?? null;
          }

          sessionTrackRows.push({
            sessionId,
            trackId: insertedTracks[flatIdx].id,
            position,
            attributedContributorId,
          });
        }

        if (sessionTrackRows.length > 0) {
          await db.insert(schema.sessionTracks).values(sessionTrackRows);
        }

        // ── Last.fm enrichment phase ────────────────────────────────────────
        const uniqueArtists = Array.from(
          new Set(trackRows.map((t) => t.artistName)),
        );
        const artistTagRows: (typeof schema.artistTags.$inferInsert)[] = [];

        for (let i = 0; i < uniqueArtists.length; i++) {
          const artistName = uniqueArtists[i];
          send({
            type: "progress",
            stage: "enriching",
            current: i + 1,
            total: uniqueArtists.length,
            message: `Enriching ${artistName}`,
          });

          const tags = await fetchArtistTags(artistName);
          for (let rankIdx = 0; rankIdx < tags.length; rankIdx++) {
            artistTagRows.push({
              artistName,
              tag: tags[rankIdx],
              rank: rankIdx + 1,
            });
          }

          // 250ms delay between calls — 4 req/sec (safely under Last.fm 5/sec limit)
          await new Promise((r) => setTimeout(r, 250));
        }

        if (artistTagRows.length > 0) {
          await db.insert(schema.artistTags).values(artistTagRows);
        }

        // Final completion event
        send({
          type: "complete",
          sessions: insertedSessions.length,
          tracks: insertedTracks.length,
          errors: plan.fetchErrors,
        });
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
