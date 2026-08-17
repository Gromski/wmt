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
  parseFallbackTracks,
  parsePlaylistDescription,
  SESSION_PLAYLIST_RE,
} from "@/lib/parse-playlist";

export const maxDuration = 300; // Explicit — matches Vercel Hobby default (RESEARCH §State of the Art)

/**
 * Pure helper (BROWSE-03 position-aware fallback design) that reconstructs a single
 * session's true round-robin grid. Apple Music playlists are person-cycling by round —
 * the starting person is encoded by the ORDER of `initials` — but a YouTube fallback pick
 * is missing from the Apple playlist, which collapses the sequence and misattributes every
 * Apple track after the gap. This helper computes each fallback's true grid position (or
 * demotes it to a bonus, appended, when it can't be placed safely) and the resulting Apple
 * track positions, so callers can attribute every grid track by `initials[(position-1)%N]`.
 *
 * No DB, no fetch, no module-level mutable state — safe to unit test directly and to call
 * once per session in the build phase below.
 */
export function buildSessionTrackPositions(input: {
  appleCount: number;
  fallbacks: Array<{ initials: string; round: number | null }>;
  initials: string[] | null;
}): {
  applePositions: number[];
  fallbackPlacements: Array<{
    index: number;
    position: number;
    kind: "grid" | "bonus";
  }>;
  demotions: Array<{ index: number; reason: string }>;
} {
  const { appleCount, fallbacks, initials } = input;

  // Unparsed session — no grid reconstruction possible; preserve 03-04 behaviour verbatim:
  // Apple tracks keep 1..appleCount, every fallback is a bonus appended in order.
  if (initials === null) {
    return {
      applePositions: Array.from({ length: appleCount }, (_, i) => i + 1),
      fallbackPlacements: fallbacks.map((_, index) => ({
        index,
        position: appleCount + index + 1,
        kind: "bonus" as const,
      })),
      demotions: [],
    };
  }

  const N = initials.length;
  const gridFallbackCount = fallbacks.filter((f) => f.round !== null).length;
  const overflowLimit = appleCount + gridFallbackCount;

  const demotions: Array<{ index: number; reason: string }> = [];
  const occupied = new Set<number>();
  // index -> resolved grid position, for fallbacks that survive as grid placements
  const gridPositionByIndex = new Map<number, number>();

  for (let index = 0; index < fallbacks.length; index++) {
    const fallback = fallbacks[index];
    if (fallback.round === null) continue; // bonus by declaration — handled below

    const slot = initials.indexOf(fallback.initials);
    if (slot === -1) {
      demotions.push({
        index,
        reason: `contributor "${fallback.initials}" not present in session initials`,
      });
      continue;
    }
    if (fallback.round < 1 || fallback.round > 4) {
      demotions.push({
        index,
        reason: `round ${fallback.round} is out of the 1-4 grid range`,
      });
      continue;
    }

    const target = (fallback.round - 1) * N + slot + 1;

    if (target > overflowLimit) {
      demotions.push({
        index,
        reason: `computed position ${target} overflows session track count ${overflowLimit}`,
      });
      continue;
    }
    if (occupied.has(target)) {
      demotions.push({
        index,
        reason: `computed position ${target} collides with another grid fallback`,
      });
      continue;
    }

    occupied.add(target);
    gridPositionByIndex.set(index, target);
  }

  // Fill Apple tracks into positions 1.., in playlist order, skipping grid-occupied slots.
  const applePositions: number[] = [];
  let candidate = 1;
  for (let i = 0; i < appleCount; i++) {
    while (occupied.has(candidate)) candidate++;
    applePositions.push(candidate);
    candidate++;
  }

  // Bonus fallbacks (declared bonus OR demoted) appended after the last used position, in
  // description order.
  const maxUsed = Math.max(0, ...occupied, ...applePositions);
  let nextBonusPosition = maxUsed + 1;

  const fallbackPlacements: Array<{
    index: number;
    position: number;
    kind: "grid" | "bonus";
  }> = [];
  for (let index = 0; index < fallbacks.length; index++) {
    const gridPosition = gridPositionByIndex.get(index);
    if (gridPosition !== undefined) {
      fallbackPlacements.push({ index, position: gridPosition, kind: "grid" });
    } else {
      fallbackPlacements.push({
        index,
        position: nextBonusPosition++,
        kind: "bonus",
      });
    }
  }

  return { applePositions, fallbackPlacements, demotions };
}

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
    initials: string[] | null;
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
      attributionInitials: string | null; // null = round-robin; non-null = explicit named-contributor override (BROWSE-03)
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

          // Build track records for the Apple Music tracks (up to 16 per playlist).
          // Positions are assigned below via buildSessionTrackPositions — NOT idx+1 —
          // because a YouTube fallback pick missing from this playlist collapses the
          // round-robin sequence for every Apple track after the gap (BROWSE-03 gap
          // closure, position-aware fallback design). Apple Music tracks never carry a
          // youtubeUrl; fallback tracks are parsed as their own entries below.
          const rawAppleTracks = items.slice(0, 16).map((item) => {
            const catalogItem = item.relationships?.catalog?.data?.[0];
            const releaseDate = catalogItem?.attributes?.releaseDate;
            const releaseYear = releaseDate
              ? Number(releaseDate.slice(0, 4)) || null
              : null;

            return {
              title: item.attributes.name,
              artistName: item.attributes.artistName,
              albumName: item.attributes.albumName ?? null,
              durationMs: item.attributes.durationInMillis ?? null,
              appleId: catalogItem?.id ?? null,
              isrc: catalogItem?.attributes?.isrc ?? null,
              releaseYear,
              youtubeUrl: null as string | null,
              attributionInitials: null as string | null,
            };
          });

          // Fallback tracks (YouTube-only, no Apple catalog match) are parsed entirely
          // from the description text. Each carries a `round` (BROWSE-03 position-aware
          // fallback design) that buildSessionTrackPositions below uses to place it at
          // its true round-robin slot (grid) or append it after the grid (bonus).
          const parsedFallbacks = parseFallbackTracks(
            p.attributes?.description?.standard,
          );

          const positions = buildSessionTrackPositions({
            appleCount: rawAppleTracks.length,
            fallbacks: parsedFallbacks.map((f) => ({
              initials: f.initials,
              round: f.round,
            })),
            initials: parsed.initials,
          });

          for (const demotion of positions.demotions) {
            const fallback = parsedFallbacks[demotion.index];
            console.log(
              `[import] demoted grid fallback to bonus for "${name}" (${fallback?.initials ?? "?"} - ${fallback?.title ?? "?"}): ${demotion.reason}`,
            );
          }

          const appleTracks: ImportPlan["sessionPlans"][0]["tracks"] =
            rawAppleTracks.map((track, idx) => ({
              ...track,
              position: positions.applePositions[idx],
            }));

          // Grid fallbacks attribute by position — initials[(position-1) % N], same as
          // every Apple track — so attributionInitials stays null for them. Bonus
          // fallbacks (declared bonus, or demoted for safety) keep the explicit
          // named-contributor override, bypassing round-robin entirely (03-04 behaviour).
          const fallbackTracks: ImportPlan["sessionPlans"][0]["tracks"] =
            positions.fallbackPlacements.map((placement) => {
              const fallback = parsedFallbacks[placement.index];
              return {
                position: placement.position,
                title: fallback.title,
                artistName: fallback.artist,
                albumName: null,
                releaseYear: null,
                durationMs: null,
                isrc: null,
                appleId: null,
                youtubeUrl: fallback.youtubeUrl,
                attributionInitials:
                  placement.kind === "bonus" ? fallback.initials : null,
              };
            });

          const tracks: ImportPlan["sessionPlans"][0]["tracks"] = [
            ...appleTracks,
            ...fallbackTracks,
          ];

          // Determine attribution: round-robin — initials[(position - 1) % initials.length]
          // pos 1→initials[0], 2→initials[1], … wraps over the attendee count (usually 4,
          // fewer when a contributor is marked MIA/AWOL — see ABSENCE_RE in parse-playlist.ts).
          // Grid fallback tracks are attributed by this same round-robin (attributionInitials
          // is null for them, above) — correct now because they occupy their true position.
          const attributionParsed = parsed.initials !== null;
          const initials = parsed.initials;

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

        // ── Build phase (pure — derived from `plan` only, no DB writes yet) ──
        // Insert tracks (flattened, tracking session+position for sessionTracks)
        interface TrackMeta {
          planSessionIndex: number;
          position: number;
          attributionInitials: string | null;
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
              attributionInitials: track.attributionInitials,
            });
          }
        }

        const uniqueArtists = Array.from(
          new Set(trackRows.map((t) => t.artistName)),
        );

        // ── Last.fm enrichment phase ────────────────────────────────────────
        // Runs BEFORE the DB transaction — never hold a transaction open across
        // network I/O (C3).
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

        // ── DB write phase ─────────────────────────────────────────────────
        // All writes happen in a single transaction (C3): a mid-import failure
        // rolls back instead of leaving the archive deleted with a partial
        // (or no) replacement.
        let insertedSessionsCount = 0;
        let insertedTracksCount = 0;

        await db.transaction(async (tx) => {
          // Preserve manually-entered session dates across the replace-all.
          // Dates don't exist in Apple Music data, so without this a re-import
          // (to pick up new tracks) wipes every date the admin entered. Capture
          // them by session_number BEFORE the delete and re-apply on insert.
          const existingDates = await tx
            .select({
              sessionNumber: schema.sessions.sessionNumber,
              date: schema.sessions.date,
            })
            .from(schema.sessions);
          const dateBySession = new Map(
            existingDates.map((r) => [r.sessionNumber, r.date]),
          );

          // Replace-all (D-04): delete child tables first, then parents
          await tx.delete(schema.artistTags);
          await tx.delete(schema.sessionTracks);
          await tx.delete(schema.tracks);
          await tx.delete(schema.sessions);

          // Upsert the four canonical contributors (never deleted)
          const contributorRows = Object.entries(KNOWN_CONTRIBUTORS).map(
            ([initials, name]) => ({ initials, name }),
          );
          await tx
            .insert(schema.contributors)
            .values(contributorRows)
            .onConflictDoNothing();

          const insertedContribs = await tx.select().from(schema.contributors);
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
            // Carry the previously-entered date over the replace-all (null if new).
            date: dateBySession.get(sp.sessionNumber) ?? null,
          }));

          let insertedSessions: { id: number }[] = [];
          if (sessionRows.length > 0) {
            insertedSessions = await tx
              .insert(schema.sessions)
              .values(sessionRows)
              .returning({ id: schema.sessions.id });
          }

          let insertedTracks: { id: number }[] = [];
          if (trackRows.length > 0) {
            insertedTracks = await tx
              .insert(schema.tracks)
              .values(trackRows)
              .returning({ id: schema.tracks.id });
          }

          // Build session_tracks join rows
          const sessionTrackRows: (typeof schema.sessionTracks.$inferInsert)[] =
            [];
          for (let flatIdx = 0; flatIdx < insertedTracks.length; flatIdx++) {
            const { planSessionIndex, position, attributionInitials } =
              trackMeta[flatIdx];
            const sessionPlan = plan.sessionPlans[planSessionIndex];
            const sessionId = insertedSessions[planSessionIndex]?.id;

            if (sessionId === undefined) continue;

            let attributedContributorId: number | null = null;
            if (attributionInitials !== null) {
              // Fallback track — explicit named-contributor attribution (BROWSE-03),
              // bypasses round-robin entirely. contribIdByInitials contains all four
              // upserted contributors, so this resolves even for a 3-person session.
              attributedContributorId =
                contribIdByInitials.get(attributionInitials) ?? null;
            } else if (sessionPlan.attributionParsed && sessionPlan.initials) {
              const slot = (position - 1) % sessionPlan.initials.length;
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
            await tx.insert(schema.sessionTracks).values(sessionTrackRows);
          }

          if (artistTagRows.length > 0) {
            await tx.insert(schema.artistTags).values(artistTagRows);
          }

          insertedSessionsCount = insertedSessions.length;
          insertedTracksCount = insertedTracks.length;
        });

        // Final completion event
        send({
          type: "complete",
          sessions: insertedSessionsCount,
          tracks: insertedTracksCount,
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
