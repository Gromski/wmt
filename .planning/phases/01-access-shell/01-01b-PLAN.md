---
phase: 01-access-shell
plan: 01b
type: execute
wave: 2
depends_on:
  - 01-01
files_modified:
  - db/schema.ts
  - lib/db.ts
  - lib/auth.ts
  - lib/auth-client.ts
  - app/api/auth/[...all]/route.ts
  - proxy.ts
  - drizzle.config.ts
  - drizzle/
  - app/page.tsx
  - app/layout.tsx
  - package.json
autonomous: false
requirements:
  - ACCESS-02
  - ACCESS-04
tags:
  - better-auth
  - drizzle
  - libsql
  - proxy
  - schema-push

must_haves:
  truths:
    - "An unauthenticated visit to http://localhost:3000/ renders the public archive shell with the 'No sessions yet' empty state and is NOT redirected"
    - "An unauthenticated visit to http://localhost:3000/dashboard returns a 307/302 redirect to /sign-in"
    - "The user, session, account, and verification tables exist in local.db after schema push (verified via libSQL CLI or sqlite3)"
    - "The user table has a role column with default 'member' and CHECK or text accepting only 'admin'|'member'"
    - "Better Auth's /api/auth/[...all] route is reachable — GET http://localhost:3000/api/auth/ok (or any Better Auth endpoint) returns a non-500 response"
    - "lib/db.ts does NOT import from lib/auth.ts (no circular dependency)"
  artifacts:
    - path: "db/schema.ts"
      provides: "Drizzle schema for Better Auth tables (user, session, account, verification) + role column extension"
      contains: "role: text(\"role\")"
    - path: "lib/db.ts"
      provides: "Drizzle libSQL client bound to schema"
      contains: "drizzle(client, { schema })"
    - path: "lib/auth.ts"
      provides: "Better Auth server config with emailAndPassword, additionalFields.role, before hook for first-user-admin"
      contains: "emailAndPassword:"
    - path: "lib/auth-client.ts"
      provides: "Better Auth React client"
      contains: "createAuthClient"
    - path: "app/api/auth/[...all]/route.ts"
      provides: "Better Auth Next.js catch-all handler"
      contains: "toNextJsHandler"
    - path: "proxy.ts"
      provides: "Next.js 16 route protection; matcher gates /dashboard only (D-04)"
      contains: "matcher:"
    - path: "drizzle.config.ts"
      provides: "drizzle-kit config pointing at db/schema.ts and DATABASE_URL"
      contains: "dialect: \"sqlite\""
    - path: "app/page.tsx"
      provides: "Public archive shell with empty state (UI-SPEC §Public Archive)"
      contains: "No sessions yet"
  key_links:
    - from: "lib/auth.ts"
      to: "lib/db.ts"
      via: "drizzleAdapter(db, ...)"
      pattern: "from .@/lib/db."
    - from: "lib/auth.ts"
      to: "db/schema.ts"
      via: "schema for Drizzle adapter + before hook count query"
      pattern: "from .@/db/schema."
    - from: "proxy.ts"
      to: "lib/auth.ts"
      via: "auth.api.getSession({ headers: await headers() })"
      pattern: "auth\\.api\\.getSession"
    - from: "app/api/auth/[...all]/route.ts"
      to: "lib/auth.ts"
      via: "toNextJsHandler(auth)"
      pattern: "toNextJsHandler\\(auth\\)"
---

<objective>
Wire the Walking Skeleton end-to-end: define the Drizzle schema (Better Auth tables + `role` column), connect libSQL, configure Better Auth with email/password + first-user-admin hook, mount the catch-all auth route, install `proxy.ts` with the `/dashboard` matcher, replace the smoke-test home page with the real public archive empty state, then BLOCKING-push the schema to local.db and prove the dev server still boots with `/` accessible and `/dashboard` redirecting.

Purpose: This plan converts the empty scaffold into a project that has a database, an auth provider, route protection, and the public archive shell. It is the last plan that does no end-user-facing auth work — but every later plan depends on these wires being live.

Output: A fully wired Walking Skeleton. After this plan, ACCESS-04 is fully satisfied (public URL exists, no login required) and ACCESS-02 is partially satisfied (proxy.ts gate is live; user-facing sign-in form lands in Plan 01-02).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-access-shell/01-CONTEXT.md
@.planning/phases/01-access-shell/01-RESEARCH.md
@.planning/phases/01-access-shell/01-PATTERNS.md
@.planning/phases/01-access-shell/01-UI-SPEC.md
@.planning/phases/01-access-shell/SKELETON.md
@.planning/phases/01-access-shell/01-01-SUMMARY.md

<interfaces>
<!-- Locked decisions consumed by this plan (CONTEXT.md): -->
<!--   D-01: public at `/`, private at `/dashboard`, no route groups -->
<!--   D-02: `/` renders archive shell + empty state, NOT a landing page -->
<!--   D-04: public routes always accessible — proxy.ts matcher must exclude them -->
<!--   D-AUTH: Better Auth emailAndPassword plugin (not social provider) -->
<!--   D-05: role column with values 'admin'|'member', default 'member' -->
<!--   D-06: first user becomes admin via databaseHooks.user.create.before -->

<!-- Cross-plan interfaces this plan CREATES (consumed by 01-02 and 01-03): -->

From lib/auth.ts:
```typescript
export const auth: ReturnType<typeof betterAuth>;
// auth.api.getSession({ headers }) -> Promise<{ user: { id, name, email, role: 'admin'|'member' }, session } | null>
```

From lib/auth-client.ts:
```typescript
export const authClient: ReturnType<typeof createAuthClient>;
// authClient.useSession()              — React hook for client components
// authClient.signIn.email({ email, password, callbackURL })
// authClient.signUp.email({ email, password, name, callbackURL })
// authClient.signOut({ fetchOptions: { onSuccess } })
```

From db/schema.ts:
```typescript
export const user;          // { id, name, email, emailVerified, image, createdAt, updatedAt, role }
export const session;       // Better Auth standard shape
export const account;       // Better Auth standard shape
export const verification;  // Better Auth standard shape
```
</interfaces>

<!-- Source files to read before editing -->
- .planning/phases/01-access-shell/01-PATTERNS.md (every code block — these are the full file contents to use)
- .planning/phases/01-access-shell/01-RESEARCH.md §Common Pitfalls (line 455-520) — Pitfalls 1, 2, 3, 5 apply directly
- .planning/phases/01-access-shell/01-UI-SPEC.md §Layout Contract → Public Archive (line 116-121)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Drizzle schema + libSQL client + drizzle.config — wire the persistence layer</name>
  <files>
    db/schema.ts, lib/db.ts, drizzle.config.ts, package.json
  </files>
  <read_first>
    - .planning/phases/01-access-shell/01-PATTERNS.md §db/schema.ts (line 160-208) — full file content
    - .planning/phases/01-access-shell/01-PATTERNS.md §lib/db.ts (line 138-157) — full file content
    - .planning/phases/01-access-shell/01-PATTERNS.md §drizzle.config.ts (line 212-229) — full file content
    - .planning/phases/01-access-shell/01-RESEARCH.md §Pattern 6 (line 372-395) — Better Auth managed tables shape
    - CLAUDE.md §Database Schema Overview — sessions / tracks / session_tracks / contributors are Phase 2+ tables; this plan only needs Better Auth tables + role
  </read_first>
  <action>
    Step 1 — Write `db/schema.ts` (per D-05, D-AUTH, RESEARCH.md Pattern 6, PATTERNS.md §db/schema.ts):

    Define four Drizzle SQLite tables matching Better Auth's expected shape, with the `user` table extended with a `role` column.

    Required exports and columns:

    - `user`:
      - `id: text("id").primaryKey()`
      - `name: text("name").notNull()`
      - `email: text("email").notNull().unique()`
      - `emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull()`
      - `image: text("image")`
      - `createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`).notNull()`
      - `updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`).$onUpdate(() => new Date()).notNull()`
      - `role: text("role", { enum: ["admin", "member"] }).notNull().default("member")` ← D-05 extension
    - `session`: standard Better Auth shape — `id (pk)`, `userId (fk→user.id)`, `token`, `expiresAt`, `ipAddress`, `userAgent`, `createdAt`, `updatedAt`. Use `.references(() => user.id, { onDelete: "cascade" })` for `userId`.
    - `account`: standard Better Auth shape — `id (pk)`, `userId (fk→user.id, cascade)`, `accountId`, `providerId`, `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `idToken`, `password` (for emailAndPassword stored hash), `createdAt`, `updatedAt`.
    - `verification`: standard Better Auth shape — `id (pk)`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`.

    The exact field names MUST match Better Auth 1.6.17's expectations — running `pnpm dlx @better-auth/cli generate --output db/auth-schema.ts` against a stub config would produce the canonical shape, but since we are pinning the schema here without a network round-trip, copy the column set verbatim from PATTERNS.md §db/schema.ts. Do NOT add app-domain tables (sessions, tracks, contributors) in this plan — those are Phase 2 territory.

    Do NOT add the Better Auth `admin` plugin's role column (RESEARCH.md Pitfall 2).

    Step 2 — Write `lib/db.ts` (per PATTERNS.md §lib/db.ts):

    ```typescript
    import { createClient } from "@libsql/client";
    import { drizzle } from "drizzle-orm/libsql";
    import * as schema from "@/db/schema";

    const client = createClient({
      url: process.env.DATABASE_URL ?? "file:local.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    export const db = drizzle(client, { schema });
    ```

    CRITICAL: `lib/db.ts` MUST NOT import from `lib/auth.ts` (RESEARCH.md Pitfall — circular dep). Only `lib/auth.ts` imports `lib/db.ts`.

    Step 3 — Write `drizzle.config.ts` (per PATTERNS.md §drizzle.config.ts):

    ```typescript
    import type { Config } from "drizzle-kit";
    import "dotenv/config";

    export default {
      schema: "./db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: {
        url: process.env.DATABASE_URL ?? "file:local.db",
        authToken: process.env.DATABASE_AUTH_TOKEN,
      },
    } satisfies Config;
    ```

    If `dotenv` is not yet a dep, add it: `pnpm add -D dotenv` (drizzle-kit doesn't auto-load `.env.local`).

    Step 4 — Add Drizzle scripts to `package.json`:

    ```
    "db:generate": "drizzle-kit generate",
    "db:push":     "drizzle-kit push",
    "db:studio":   "drizzle-kit studio"
    ```

    Step 5 — Sanity typecheck:

    Run `pnpm run typecheck`. The schema file must compile cleanly (no missing imports). If `sql` is missing, add `import { sql } from "drizzle-orm"`.

    Do NOT run `db:push` here — it is gated by Task 4 (BLOCKING schema-push gate) and must happen AFTER `lib/auth.ts` exists, because Better Auth verifies the schema shape on first import in dev.
  </action>
  <verify>
    <automated>
      test -f db/schema.ts &&
      test -f lib/db.ts &&
      test -f drizzle.config.ts &&
      grep -q 'sqliteTable.*"user"' db/schema.ts &&
      grep -q 'sqliteTable.*"session"' db/schema.ts &&
      grep -q 'sqliteTable.*"account"' db/schema.ts &&
      grep -q 'sqliteTable.*"verification"' db/schema.ts &&
      grep -E 'role: text\("role"' db/schema.ts &&
      grep -q 'default("member")' db/schema.ts &&
      grep -q 'drizzle(client, { schema })' lib/db.ts &&
      ! grep -q '@/lib/auth' lib/db.ts &&
      grep -q '"db:push"' package.json &&
      pnpm run typecheck
    </automated>
  </verify>
  <acceptance_criteria>
    - `db/schema.ts` exports `user`, `session`, `account`, `verification` tables
    - `user` table has a `role` column with enum `['admin', 'member']` and default `'member'`
    - `lib/db.ts` does NOT import anything from `@/lib/auth` (verified by grep)
    - `drizzle.config.ts` reads `DATABASE_URL` from env with `file:local.db` fallback
    - `db:generate`, `db:push`, `db:studio` scripts present in `package.json`
    - `pnpm run typecheck` exits 0
  </acceptance_criteria>
  <done>Persistence layer is defined in code. No DB writes yet — schema push is gated to Task 4.</done>
</task>

<task type="auto">
  <name>Task 2: Better Auth server config + React client + catch-all route</name>
  <files>
    lib/auth.ts, lib/auth-client.ts, app/api/auth/[...all]/route.ts
  </files>
  <read_first>
    - .planning/phases/01-access-shell/01-PATTERNS.md §lib/auth.ts (line 35-91) — full file content
    - .planning/phases/01-access-shell/01-PATTERNS.md §lib/auth-client.ts (line 95-133) — full file content + usage examples
    - .planning/phases/01-access-shell/01-PATTERNS.md §app/api/auth/[...all]/route.ts (line 269-281) — full file content
    - .planning/phases/01-access-shell/01-RESEARCH.md §Pattern 1 (line 214-269) — server config rationale
    - .planning/phases/01-access-shell/01-RESEARCH.md §Pitfall 1 (line 456-466) — MUST use `before` hook, not `after`
    - .planning/phases/01-access-shell/01-RESEARCH.md §Pitfall 5 (line 497-504) — `BETTER_AUTH_SECRET` requirement
  </read_first>
  <action>
    Step 1 — Write `lib/auth.ts` (per D-AUTH, D-05, D-06, D-07; RESEARCH.md Pattern 1; PATTERNS.md §lib/auth.ts):

    ```typescript
    import { betterAuth } from "better-auth";
    import { drizzleAdapter } from "better-auth/adapters/drizzle";
    import { sql } from "drizzle-orm";
    import { db } from "@/lib/db";
    import * as schema from "@/db/schema";

    export const auth = betterAuth({
      database: drizzleAdapter(db, {
        provider: "sqlite",
        schema,
      }),
      emailAndPassword: {
        enabled: true,
        // No requireEmailVerification — trusted 4-person group (CONTEXT.md §Specifics)
      },
      user: {
        additionalFields: {
          role: {
            type: ["admin", "member"] as const,
            required: false,
            defaultValue: "member",
            input: false, // users cannot set their own role on signup (security: role escalation)
          },
        },
      },
      databaseHooks: {
        user: {
          create: {
            before: async (user) => {
              // First-user-is-admin rule (D-06).
              // MUST be `before` hook — `after` cannot return modified data atomically (RESEARCH.md Pitfall 1).
              const result =
                (await db
                  .select({ count: sql<number>`count(*)` })
                  .from(schema.user)
                  .get()) ?? { count: 0 };
              if (Number(result.count) === 0) {
                return { data: { ...user, role: "admin" } };
              }
              // Default role 'member' applies for all subsequent users.
            },
          },
        },
      },
    });
    ```

    CRITICAL rules from RESEARCH.md (do NOT diverge):
    - Use `before` hook, NEVER `after` — Pitfall 1
    - Do NOT also load the Better Auth `admin` plugin — Pitfall 2 (schema conflict on `role` column)
    - `input: false` on the role field prevents users from setting `role: 'admin'` in their own signup payload (security control)

    Step 2 — Write `lib/auth-client.ts` (per PATTERNS.md §lib/auth-client.ts):

    ```typescript
    import { createAuthClient } from "better-auth/react";

    export const authClient = createAuthClient({
      baseURL: process.env.NEXT_PUBLIC_APP_URL,
    });
    ```

    Step 3 — Write `app/api/auth/[...all]/route.ts` (per PATTERNS.md §app/api/auth):

    ```typescript
    import { auth } from "@/lib/auth";
    import { toNextJsHandler } from "better-auth/next-js";

    export const { POST, GET } = toNextJsHandler(auth);
    ```

    The bracketed catch-all `[...all]` is intentional — this single route handles every Better Auth endpoint (`/sign-in/email`, `/sign-up/email`, `/sign-out`, `/get-session`, etc.).

    Step 4 — Typecheck. Run `pnpm run typecheck`. Better Auth 1.6.17's type inference will read `additionalFields.role` and propagate `role: 'admin' | 'member'` onto `session.user`. If the typecheck reports the `role` field as `unknown` on `auth.api.getSession()`'s return, double-check that `additionalFields.role.type` is exactly `["admin", "member"] as const`.

    Do NOT attempt to boot the dev server here — `auth.api.getSession()` will fail if the schema is not yet pushed. Schema push happens in Task 4.
  </action>
  <verify>
    <automated>
      test -f lib/auth.ts &&
      test -f lib/auth-client.ts &&
      test -f "app/api/auth/[...all]/route.ts" &&
      grep -q 'emailAndPassword' lib/auth.ts &&
      grep -q 'additionalFields' lib/auth.ts &&
      grep -q 'create: {' lib/auth.ts &&
      grep -q 'before: async' lib/auth.ts &&
      ! grep -q 'after: async (user) => {' lib/auth.ts &&
      ! grep -q 'adminPlugin' lib/auth.ts &&
      ! grep -q "plugins:.*admin" lib/auth.ts &&
      grep -q 'createAuthClient' lib/auth-client.ts &&
      grep -q 'toNextJsHandler(auth)' "app/api/auth/[...all]/route.ts" &&
      pnpm run typecheck
    </automated>
  </verify>
  <acceptance_criteria>
    - `lib/auth.ts` uses `emailAndPassword: { enabled: true }`, declares `additionalFields.role` with `input: false`, and implements the first-user-admin rule in the `before` hook
    - No Better Auth `admin` plugin is loaded (RESEARCH.md Pitfall 2)
    - `lib/auth-client.ts` exports `authClient` with `baseURL: process.env.NEXT_PUBLIC_APP_URL`
    - `app/api/auth/[...all]/route.ts` exports `GET` and `POST` via `toNextJsHandler(auth)`
    - `pnpm run typecheck` exits 0
  </acceptance_criteria>
  <done>Better Auth is configured with email/password, the role field, and the first-user-admin hook. Catch-all auth route is mounted. No DB writes yet.</done>
</task>

<task type="auto">
  <name>Task 3: proxy.ts + public archive shell (replace smoke page) + final layout polish</name>
  <files>
    proxy.ts, app/page.tsx, app/layout.tsx
  </files>
  <read_first>
    - .planning/phases/01-access-shell/01-PATTERNS.md §proxy.ts (line 233-266) — full file content
    - .planning/phases/01-access-shell/01-PATTERNS.md §app/page.tsx (line 428-447) — public archive pattern
    - .planning/phases/01-access-shell/01-RESEARCH.md §Pattern 4 (line 322-350) — proxy.ts rationale
    - .planning/phases/01-access-shell/01-RESEARCH.md §Pitfall 3 (line 475-487) — use `await headers()`
    - .planning/phases/01-access-shell/01-RESEARCH.md §Pitfall 7 (line 514-518) — do NOT create middleware.ts
    - .planning/phases/01-access-shell/01-UI-SPEC.md §Layout Contract → Public Archive `/` (line 116-121)
    - .planning/phases/01-access-shell/01-UI-SPEC.md §Copywriting Contract (line 132-147) — empty state copy
  </read_first>
  <action>
    Step 1 — Write `proxy.ts` at project root (per D-04, RESEARCH.md Pattern 4, PATTERNS.md §proxy.ts):

    ```typescript
    import { NextRequest, NextResponse } from "next/server";
    import { headers } from "next/headers";
    import { auth } from "@/lib/auth";

    export async function proxy(request: NextRequest) {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session) {
        const signInUrl = new URL("/sign-in", request.url);
        return NextResponse.redirect(signInUrl);
      }

      return NextResponse.next();
    }

    export const config = {
      matcher: ["/dashboard", "/dashboard/:path*"],
    };
    ```

    CRITICAL rules:
    - The exported function MUST be named `proxy`, NOT `middleware` (Next.js 16 renamed; RESEARCH.md §State of the Art)
    - The matcher MUST be exactly `["/dashboard", "/dashboard/:path*"]` — D-04 forbids redirecting public routes
    - Use `await headers()` from `next/headers`, NEVER `request.headers` — RESEARCH.md Pitfall 3
    - Do NOT also create a `middleware.ts` file — Pitfall 7. If one was scaffolded by create-next-app, DELETE it.

    Verify no `middleware.ts` exists: `test ! -f middleware.ts && test ! -f src/middleware.ts`. Delete if found.

    Step 2 — Replace `app/page.tsx` (the smoke-test screen from Plan 01-01) with the real public archive empty state (per D-02, UI-SPEC §Layout Contract → Public Archive `/`, UI-SPEC §Copywriting Contract):

    Server Component. No `"use cache"` directive in Phase 1 — that lands in Phase 3 when the page has real data. Layout: single column, `max-w-[720px]`, horizontally centered, top padding `pt-16` (64px, UI-SPEC §Spacing 3xl).

    Render:
    - `<main>` with the layout classes above
    - `<h1>` heading: text "No sessions yet" — UI-SPEC: heading role (20px semibold), `text-xl font-semibold`
    - `<p>` body: text "Sessions will appear here once the archive has been imported. Check back soon." — UI-SPEC body + muted-foreground, `text-base text-muted-foreground mt-4`
    - Page is fully accessible without auth — D-04. proxy.ts matcher excludes `/`.

    Final shape:

    ```tsx
    export default function ArchivePage() {
      return (
        <main className="mx-auto max-w-[720px] px-6 pt-16">
          <h1 className="text-xl font-semibold">No sessions yet</h1>
          <p className="mt-4 text-base text-muted-foreground">
            Sessions will appear here once the archive has been imported. Check back soon.
          </p>
        </main>
      );
    }
    ```

    Step 3 — `app/layout.tsx` already mounts Inter + Toaster from Plan 01-01. Plan 01-02 will add the GlobalHeader to this layout. Confirm `app/layout.tsx` from Plan 01-01 is unchanged — no edits in this plan unless the typecheck demands it.
  </action>
  <verify>
    <automated>
      test -f proxy.ts &&
      ! test -f middleware.ts &&
      ! test -f src/middleware.ts &&
      grep -q 'export async function proxy' proxy.ts &&
      grep -q 'matcher:' proxy.ts &&
      grep -q '/dashboard' proxy.ts &&
      ! grep -q '"/"' proxy.ts &&
      grep -q "from \"next/headers\"" proxy.ts &&
      grep -q "await headers()" proxy.ts &&
      grep -q 'No sessions yet' app/page.tsx &&
      grep -q 'max-w-\[720px\]' app/page.tsx &&
      pnpm run typecheck
    </automated>
  </verify>
  <acceptance_criteria>
    - `proxy.ts` exports `proxy` (not `middleware`), uses `await headers()` from `next/headers`, and matcher is exactly `["/dashboard", "/dashboard/:path*"]`
    - No `middleware.ts` exists at project root or under `src/`
    - `app/page.tsx` renders the UI-SPEC empty state with exact heading + body copy
    - `pnpm run typecheck` exits 0
  </acceptance_criteria>
  <done>proxy.ts gate is live, public `/` is the real archive shell with empty state. All public routes remain accessible without auth.</done>
</task>

<task type="auto">
  <name>Task 4: BLOCKING schema push — apply Drizzle schema to local.db</name>
  <files>drizzle/, local.db</files>
  <read_first>
    - drizzle.config.ts (just written in Task 1)
    - db/schema.ts (just written in Task 1)
    - lib/auth.ts (just written in Task 2)
  </read_first>
  <action>
    This task is the BLOCKING schema-push step required by the orchestrator. It MUST run AFTER db/schema.ts AND lib/auth.ts are both written (Task 1 + Task 2) and BEFORE the smoke-boot verification (Task 5). It is the first DB write in the project.

    Step 1 — Generate the migration SQL (optional but useful for git history):

    ```
    pnpm run db:generate
    ```

    Drizzle-kit will create `drizzle/0000_*.sql` with the CREATE TABLE statements. Commit-worthy artifact.

    Step 2 — Push to local.db:

    ```
    pnpm run db:push
    ```

    This applies the schema directly to `local.db` (read from `DATABASE_URL=file:local.db` via dotenv). drizzle-kit will prompt if any destructive action is detected — for a fresh schema push on an empty DB this should be a clean no-prompt run. If it asks anything, abort and re-read this plan — there should be no existing tables.

    Step 3 — Verify table existence using the libSQL CLI (the @libsql/client package ships its own; otherwise use the system `sqlite3`):

    ```
    sqlite3 local.db ".tables"
    ```

    Expected output: `account  session  user  verification` (alphabetised).

    Step 4 — Verify the `role` column on the user table:

    ```
    sqlite3 local.db "PRAGMA table_info(user);"
    ```

    Expected: a row with `name=role`, `type=text`, `dflt_value='member'`, `notnull=1`.
  </action>
  <verify>
    <automated>
      test -f local.db &&
      sqlite3 local.db ".tables" | grep -q "user" &&
      sqlite3 local.db ".tables" | grep -q "session" &&
      sqlite3 local.db ".tables" | grep -q "account" &&
      sqlite3 local.db ".tables" | grep -q "verification" &&
      sqlite3 local.db "PRAGMA table_info(user);" | grep -q "role" &&
      sqlite3 local.db "PRAGMA table_info(user);" | grep -E "role.*text.*'member'"
    </automated>
  </verify>
  <acceptance_criteria>
    - `local.db` exists at project root and is gitignored
    - All four Better Auth tables (`user`, `session`, `account`, `verification`) exist in `local.db`
    - `user.role` column is `text`, `NOT NULL`, default `'member'`
    - `drizzle/0000_*.sql` migration file exists (committed for traceability)
    - No other tables exist yet (no app-domain tables — those are Phase 2)
  </acceptance_criteria>
  <done>Schema is materialised in local.db. Better Auth can now create rows on first sign-up.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    The Walking Skeleton is wired: schema is in local.db, Better Auth is configured, proxy.ts gates /dashboard, and the public archive shell renders at /. This verify step confirms ACCESS-04 is satisfied (public URL works without login) and proxy.ts redirects /dashboard correctly.
  </what-built>
  <how-to-verify>
    1. `pnpm dev` and wait for `Ready in ...`.
    2. Open http://localhost:3000/ in a **private/incognito window** (so no cookies).
    3. Confirm the page renders with heading "No sessions yet" and body "Sessions will appear here once the archive has been imported. Check back soon." on a dark zinc background.
    4. Confirm the page is NOT redirected — the URL stays at `/`. (Dim victory for ACCESS-04.)
    5. In the same window, navigate to http://localhost:3000/dashboard. You should see a 307 redirect to `/sign-in`. The `/sign-in` page does not exist yet (404 expected) — this proves proxy.ts is enforcing the gate.
    6. In the same window, open the Network tab and request GET http://localhost:3000/api/auth/session. The Better Auth catch-all should respond (likely a JSON `null` or empty session object — status 200, NOT 404). If it 404s, the catch-all route filename is wrong.
    7. Stop the dev server (Ctrl+C).
    8. Run `sqlite3 local.db "PRAGMA table_info(user);"` and confirm the `role` column appears with default `'member'`.

    If `/` redirects to `/sign-in`, the proxy.ts matcher is wrong — it should NOT include `/`. Re-read Task 3 Step 1.
    If `/dashboard` returns 200 instead of redirecting, proxy.ts is not active — confirm `proxy.ts` is at the project root (not under `app/`) and the export name is `proxy`.
  </how-to-verify>
  <resume-signal>Type "approved" if all 8 verification steps pass. Otherwise describe which step failed and what you observed.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser ↔ Next.js (proxy.ts) | Untrusted request crosses here; proxy.ts is the first gate |
| Browser ↔ /api/auth/* | Sign-up / sign-in payloads (email, password) cross here |
| Next.js ↔ libSQL (local.db) | Better Auth writes user rows; first-user-admin hook reads count |
| Filesystem (local.db) ↔ developer machine | Persisted credentials live on disk in dev |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01b-01 | Spoofing | proxy.ts session lookup | mitigate | Use `await headers()` from `next/headers` to get the full cookie context — passing `request.headers` would not always include the auth cookie (RESEARCH.md Pitfall 3) |
| T-01b-02 | Elevation of Privilege | additionalFields.role on signup | mitigate | `input: false` on the role field prevents users supplying `role: 'admin'` in the signup payload (RESEARCH.md §Security Domain row "Role escalation via sign-up form") |
| T-01b-03 | Elevation of Privilege | First-user-is-admin rule | accept | RESEARCH.md §Pitfall 1 + CONTEXT.md §Specifics: Mark registers first; if the wrong user races to register first, a manual `UPDATE user SET role='member' WHERE id=...` corrects it — acceptable in a coordinated 4-person team |
| T-01b-04 | Information Disclosure | Public `/` rendering | accept | Page renders only static empty-state copy — no PII, no DB read, no session lookup. D-04 makes the page public by design |
| T-01b-05 | Tampering | Drizzle schema push to local.db | accept | local.db is dev-only and gitignored; production target is Turso via env-driven DATABASE_URL — push runs only against the developer's local DB |
| T-01b-06 | Repudiation | Better Auth session creation | mitigate | Better Auth writes a `session` row with `createdAt`, `userAgent`, `ipAddress` for audit (default schema columns) |
| T-01b-07 | Information Disclosure | BETTER_AUTH_SECRET in `.env.local` | mitigate | Plan 01-01 confirmed `.env.local` is gitignored; secret is 32 random bytes from `openssl rand -base64 32` |
</threat_model>

<verification>
After this plan, the following must hold:

- `local.db` exists with `user`, `session`, `account`, `verification` tables
- `user.role` defaults to `'member'`, `text NOT NULL` with enum constraint or simple text column
- `proxy.ts` at project root redirects unauthenticated `/dashboard` requests to `/sign-in`
- Unauthenticated `/` renders the empty state with no redirect
- `/api/auth/get-session` responds (200, JSON body)
- `pnpm run typecheck` exits 0
- `pnpm run lint` exits 0
- No `middleware.ts` exists
</verification>

<success_criteria>
1. Persistence layer (Drizzle + libSQL) connected and schema applied to local.db
2. Better Auth email/password configured with role column and first-user-admin hook
3. Catch-all auth route handler is mounted at /api/auth/[...all]
4. proxy.ts gates /dashboard only — public routes are unaffected (D-04)
5. Public archive shell at / renders the UI-SPEC empty state without auth
6. Schema push is BLOCKING-completed and verified before final smoke check
7. ACCESS-04 is fully satisfied (public URL accessible without login)
8. ACCESS-02 has its route-gating foundation (sign-in form lands in Plan 01-02)
</success_criteria>

<output>
Create `.planning/phases/01-access-shell/01-01b-SUMMARY.md` when done.

SUMMARY must include:
- Confirmation of all four Better Auth tables in local.db
- Confirmation of `role` column on `user` table with default `'member'`
- Path to generated migration: `drizzle/0000_*.sql`
- Confirmation of proxy.ts matcher and `await headers()` usage
- Whether `/api/auth/get-session` responded with 200 in the human verify step
- Cross-plan interfaces ready for Plan 01-02: `auth`, `authClient`, schema types
</output>
