import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Phase 1 stub — Phase 2 will replace this with real import orchestration.
  // The Phase 2 author should preserve the 401/403 gates above.
  return Response.json({ message: "Import queued" }, { status: 202 });
}
