import { and, eq, gte, lte } from "drizzle-orm";
import { headers } from "next/headers";

import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { KNOWN_CONTRIBUTORS } from "@/lib/parse-playlist";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth gate — 401 before 403 per Phase 1 §Shared Patterns §Auth Gate (T-02-03-01)
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve and validate session id from URL params (T-02-03-04)
  const { id } = await params;
  const sessionId = Number(id);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return Response.json({ error: "Invalid session id" }, { status: 400 });
  }

  // Parse and validate the initials body (T-02-03-03)
  const body = (await request.json().catch(() => ({}))) as {
    initials?: unknown;
  };

  if (
    !Array.isArray(body.initials) ||
    body.initials.length !== 4 ||
    body.initials.some((s) => typeof s !== "string")
  ) {
    return Response.json(
      { error: "initials must be a 4-string array" },
      { status: 400 },
    );
  }

  const initials = body.initials as [string, string, string, string];

  // Validate each entry is a known contributor (D-12 allowlist — T-02-03-03)
  for (const initial of initials) {
    if (!Object.hasOwn(KNOWN_CONTRIBUTORS, initial)) {
      return Response.json(
        { error: `Unknown initials: ${initial}` },
        { status: 400 },
      );
    }
  }

  // Validate distinctness (D-12 four-slot rule)
  if (new Set(initials).size !== 4) {
    return Response.json({ error: "Duplicate initials" }, { status: 400 });
  }

  // Resolve contributor ids from DB
  const contribs = await db.select().from(schema.contributors);
  const idByInitials = new Map(contribs.map((c) => [c.initials, c.id]));

  // Update 4 position-range slots (positions 1-4, 5-8, 9-12, 13-16)
  for (let slot = 0; slot < 4; slot++) {
    const contribInitials = initials[slot];
    const contribId = idByInitials.get(contribInitials);

    if (contribId === undefined) {
      return Response.json(
        {
          error: `Contributor row missing for ${contribInitials} — re-run import`,
        },
        { status: 500 },
      );
    }

    const fromPos = slot * 4 + 1;
    const toPos = slot * 4 + 4;

    // Canonical position-range update: equality on sessionId, inclusive bounds on position
    await db
      .update(schema.sessionTracks)
      .set({ attributedContributorId: contribId })
      .where(
        and(
          eq(schema.sessionTracks.sessionId, sessionId),
          gte(schema.sessionTracks.position, fromPos),
          lte(schema.sessionTracks.position, toPos),
        ),
      );
  }

  // Flip attribution_parsed = true on success
  await db
    .update(schema.sessions)
    .set({ attributionParsed: true })
    .where(eq(schema.sessions.id, sessionId));

  return Response.json({ ok: true });
}
