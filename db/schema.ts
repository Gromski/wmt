import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Better Auth managed table — shape matches betterauth/cli generate output
// Extended with `role` column per D-05 (additionalFields config in lib/auth.ts)
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
  // D-05: role column — additionalFields extension matching auth.ts config
  // NOT the Better Auth admin plugin (would conflict — RESEARCH.md Pitfall 2)
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(), // IN-02: match notNull convention used in user/session/account tables
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(), // IN-02: match notNull convention used in user/session/account tables
});

// --- Phase 2: App-specific tables (integer PK with autoIncrement, NOT Better Auth text PKs) ---

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionNumber: integer("session_number").notNull().unique(),
  theme: text("theme").notNull(),
  date: integer("date", { mode: "timestamp_ms" }), // nullable — manual input per D-10
  description: text("description"),
  attributionParsed: integer("attribution_parsed", { mode: "boolean" })
    .notNull()
    .default(true), // false → shown in Attribution Error Card (IMPORT-08)
  appleMusicPlaylistId: text("apple_music_playlist_id"),
});

export const contributors = sqliteTable("contributors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  initials: text("initials").notNull().unique(), // MW, JG, JS, IT per D-12
  name: text("name").notNull(),
  userId: text("user_id").references(() => user.id), // nullable — populated if contributor also has an account
});

export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appleId: text("apple_id"), // catalog song ID (from catalog relationship)
  spotifyId: text("spotify_id"), // null until Phase 3
  isrc: text("isrc"), // from catalog relationship; nullable
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  albumName: text("album_name"),
  releaseYear: integer("release_year"),
  durationMs: integer("duration_ms"),
});

export const sessionTracks = sqliteTable("session_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  trackId: integer("track_id")
    .notNull()
    .references(() => tracks.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // 1–16 per D-12
  attributedContributorId: integer("attributed_contributor_id").references(
    () => contributors.id,
  ), // nullable for IMPORT-08 unassigned slots
});

export const artistTags = sqliteTable("artist_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  artistName: text("artist_name").notNull(),
  tag: text("tag").notNull(),
  rank: integer("rank").notNull(), // 1 = top tag per D-08
});
