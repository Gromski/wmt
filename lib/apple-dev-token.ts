import { createPrivateKey } from "node:crypto";

import { SignJWT } from "jose";

// Server-only utility — never import from "use client" components.
// Validates and uses APPLE_* env vars at function-call time (not module load)
// so a missing key produces a clean 500 from /api/apple-token without
// preventing the dev server from booting.

export async function generateAppleDeveloperToken(): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) throw new Error("APPLE_TEAM_ID env var is not set");

  const keyId = process.env.APPLE_KEY_ID;
  if (!keyId) throw new Error("APPLE_KEY_ID env var is not set");

  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!rawKey) throw new Error("APPLE_PRIVATE_KEY env var is not set");

  // Pitfall 1: .env.local stores \n as literal two chars; createPrivateKey requires real newlines.
  const privateKey = createPrivateKey(rawKey.replace(/\\n/g, "\n"));

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}
