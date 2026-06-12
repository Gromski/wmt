import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:local.db",
    // authToken is only valid for Turso (libsql) dialect; omitted here for SQLite local dev
    // For Turso production, switch dialect to "turso" and add authToken
  },
} satisfies Config;
