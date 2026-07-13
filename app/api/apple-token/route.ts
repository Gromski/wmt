import { headers } from "next/headers";

import { generateAppleDeveloperToken } from "@/lib/apple-dev-token";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const token = await generateAppleDeveloperToken();
    return Response.json({ token });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Token generation failed",
      },
      { status: 500 },
    );
  }
}
