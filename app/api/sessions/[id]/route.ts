import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  // Resolve and validate session id from URL params
  const { id } = await params;
  const sessionId = Number(id);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return Response.json({ error: "Invalid session id" }, { status: 400 });
  }

  // Parse body — accept { date: ISOString | null } (T-02-03-02)
  const body = (await request.json().catch(() => ({}))) as {
    date?: string | null;
  };

  let dateValue: Date | null;

  if (body.date === null || body.date === undefined) {
    // Explicit null or missing key → clear the date
    dateValue = null;
  } else {
    const parsed = new Date(body.date).getTime();
    if (Number.isNaN(parsed)) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }
    dateValue = new Date(parsed);
  }

  // Update session date — Drizzle bound parameter (no SQLi surface per T-02-03-02)
  // schema.sessions.date is timestamp_ms mode — accepts Date | null
  await db
    .update(schema.sessions)
    .set({ date: dateValue })
    .where(eq(schema.sessions.id, sessionId));

  return Response.json({ ok: true });
}
