import { createAuthClient } from "better-auth/react";

// WR-04: Fall back to localhost:3000 in local dev when NEXT_PUBLIC_APP_URL is
// not set. In production, the env var must be set explicitly — if it is wrong
// (e.g., a staging URL) auth requests will be sent to the wrong origin, so
// ensure this is configured correctly via the deployment environment.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
