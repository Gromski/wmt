import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

// IMPORTANT: lib/db.ts must NOT import from lib/auth.ts
// Only lib/auth.ts imports lib/db.ts (circular dep risk — RESEARCH.md Pattern 1)

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
  // authToken is undefined in local dev — @libsql/client ignores it safely
});

export const db = drizzle(client, { schema });
