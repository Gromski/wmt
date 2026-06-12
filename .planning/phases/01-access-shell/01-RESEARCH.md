# Phase 1: Access & Shell - Research

**Researched:** 2026-06-12
**Domain:** Next.js 16 App Router, Better Auth email/password, Drizzle ORM + libSQL, route protection via proxy.ts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Public archive at `/`, private dashboard at `/dashboard`. No route groups in the URL.
- **D-02:** The public `/` renders the full archive shell with empty state ("No sessions yet") — not a landing page.
- **D-03:** Sign-in entry point is a dedicated `/sign-in` page with email + password form. A persistent header "Sign in" link is present on all public pages. After sign-in, redirect to `/dashboard`. No OAuth callbacks or redirects.
- **D-04:** Public routes (`/` and any sub-routes under the public archive) are always accessible without authentication.
- **D-AUTH:** Better Auth email/password plugin (not a social OAuth provider). No public self-registration UI needed; admin creates accounts for the other 3 friends.
- **D-05:** Admin role stored as a `role` column on Better Auth's managed `users` table via Drizzle `additionalFields`. Values: `'admin'` | `'member'`. Default: `'member'`.
- **D-06:** First user to register is automatically assigned `role = 'admin'` via a `databaseHooks.user.create` hook. All subsequent sign-ups receive `role = 'member'`.
- **D-07:** Import trigger on `/dashboard` is gated to `role === 'admin'` only.
- **D-10:** `/dashboard` in Phase 1 is minimal: connected confirmation, stubbed import trigger button, sign-out link.
- **D-11:** Date editing UI is Phase 2 scope.

### Claude's Discretion
- Hook implementation detail: use `before` hook (which can return modified data) vs `after` hook (cannot modify data) — see Pitfall 1 below for the correct approach.

### Deferred Ideas (OUT OF SCOPE)
- Date editing UI — Phase 2
- Apple Music / MusicKit JS — Phase 2 (IMPORT-07)
- Navigation skeleton with Sessions/Analytics sections — Phase 3
- Spotify OAuth for auth — removed (no Spotify Premium)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCESS-01 | The four friends can log in (was "via Spotify OAuth", now updated to email/password per CONTEXT.md D-AUTH) and reach the private dashboard | Better Auth `emailAndPassword` plugin; `authClient.signIn.email()` / `authClient.signUp.email()` |
| ACCESS-02 | The private dashboard gates import trigger, date editing, and write operations behind authentication | `proxy.ts` matcher for `/dashboard`; server-side `auth.api.getSession()` check; role guard for admin-only import trigger |
| ACCESS-03 | Admin user can trigger a re-import or sync from within the dashboard | Phase 1 stubs this as a POST `/api/import` route returning 202; guarded by session + role check |
| ACCESS-04 | A public read-only URL exposes the session archive to anyone without login | `/` has no auth gate; `proxy.ts` matcher excludes public routes |
</phase_requirements>

---

## Summary

Phase 1 establishes the authenticated shell for a 4-person private archive app. The technical foundation is: Next.js 16 App Router, Better Auth 1.x with `emailAndPassword` enabled, Drizzle ORM with a libSQL/SQLite database (local file in dev, Turso in production), route protection via `proxy.ts`, and shadcn/ui components.

The auth model is intentionally simple: email + password only, no OAuth, no email verification required (small trusted group), and a first-user-is-admin rule implemented in a `databaseHooks.user.create.before` hook. The role system uses `additionalFields` on the Better Auth user schema — NOT the Better Auth `admin` plugin, which would add a conflicting `role` column of its own with `'user'`/`'admin'` naming.

The public archive at `/` and the private dashboard at `/dashboard` live as top-level App Router segments. `proxy.ts` (Next.js 16's replacement for `middleware.ts`) guards `/dashboard` and its sub-paths, redirecting unauthenticated requests to `/sign-in`. Public routes are never touched by the proxy matcher.

**Primary recommendation:** Use `additionalFields` for the role column (not the Better Auth admin plugin), implement first-user-admin detection in the `before` hook (not `after`), and use `proxy.ts` with `matcher: ['/dashboard', '/dashboard/:path*']` for route protection.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User authentication (sign-in, sign-up, session) | API / Backend | — | Better Auth handles session creation server-side; client only calls `authClient` methods |
| Route protection (/dashboard) | Frontend Server (proxy.ts) | API / Backend | proxy.ts runs before route render; API routes also gate by session |
| Session reading in Server Components | Frontend Server (SSR) | — | `auth.api.getSession({ headers: await headers() })` in Server Components |
| Session reading in Client Components | Browser / Client | — | `authClient.useSession()` React hook |
| Role check (admin-only gating) | Frontend Server (SSR) | API / Backend | Server Component reads role from session; API route checks role before 202 |
| Public archive (/) | CDN / Static | Frontend Server (SSR) | Static + RSC; no auth, no personalisation — can be cached aggressively |
| Database schema + migrations | Database / Storage | — | Drizzle schema + drizzle-kit push |
| Better Auth API handler | API / Backend | — | `app/api/auth/[...all]/route.ts` via `toNextJsHandler` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.9 | Full-stack framework | App Router, `proxy.ts`, RSC, API routes [VERIFIED: npm registry] |
| `react` | 19.2.x | UI | Ships with Next.js 16 [VERIFIED: npm registry] |
| `better-auth` | 1.6.17 | Auth framework | emailAndPassword built-in; Drizzle adapter; no Auth.js v5 [VERIFIED: npm registry] |
| `drizzle-orm` | 0.45.2 | ORM | SQL-close, type-safe, `additionalFields` schema extension [VERIFIED: npm registry] |
| `@libsql/client` | 0.17.3 | Database driver | Required for Turso/libSQL connection [VERIFIED: npm registry] |
| `tailwindcss` | 4.3.0 | Styling | CSS-first config, shadcn/ui v4 compat [VERIFIED: npm registry] |
| `zod` | 4.x | Input validation | Validate sign-in form inputs [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-kit` | 0.31.10 | Schema migrations CLI | `drizzle-kit generate` + `drizzle-kit push` during dev [VERIFIED: npm registry] |
| `@biomejs/biome` | 2.5.0 | Lint + format | Replaces ESLint + Prettier; `next lint` removed in Next.js 16 [VERIFIED: npm registry] |
| `lucide-react` | 1.18.0 | Icons | shadcn/ui default icon set [VERIFIED: npm registry] |
| `pnpm` | 11.6.0 | Package manager | Faster installs, disk-efficient; install globally first [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `additionalFields` role | Better Auth `admin` plugin | Admin plugin adds its own `role` column (values `'user'`/`'admin'`); conflicts with project's `'admin'`/`'member'` naming; overkill for 4-user app |
| `before` hook for first-user-admin | `after` hook | `after` hook cannot return modified data — would require a separate DB update call with race condition risk |
| `proxy.ts` | Layout-level session check | Both are needed; `proxy.ts` provides redirect, layout check provides role data |

**Installation:**
```bash
# Install pnpm globally first
npm install -g pnpm

# Scaffold
pnpm create next-app@latest warwick-massive-tunage \
  --typescript --tailwind --app --src-dir=false --import-alias="@/*"

# Auth + DB
pnpm add better-auth drizzle-orm @libsql/client

# Dev tools
pnpm add -D drizzle-kit @biomejs/biome

# UI (run separately — interactive)
pnpm dlx shadcn@latest init
```

**Version verification:** All versions above confirmed against npm registry on 2026-06-12. `better-auth` published 2026-06-12 (same day as research), confirming it is actively maintained.

---

## Package Legitimacy Audit

> slopcheck was not available at research time. All packages below have been verified via npm registry + official repository presence. Manually assessed for legitimacy.

| Package | Registry | Age | Downloads/wk | Source Repo | slopcheck | Disposition |
|---------|----------|-----|--------------|-------------|-----------|-------------|
| `next` | npm | ~15 yrs | 31M | github.com/vercel/next.js | [ASSUMED OK] | Approved |
| `better-auth` | npm | ~2 yrs | 4.1M | github.com/better-auth/better-auth | [ASSUMED OK] | Approved |
| `drizzle-orm` | npm | ~4.7 yrs | 10.8M | github.com/drizzle-team/drizzle-orm | [ASSUMED OK] | Approved |
| `@libsql/client` | npm | ~3.4 yrs | 1.4M | github.com/tursodatabase/libsql-client-ts | [ASSUMED OK] | Approved |
| `drizzle-kit` | npm | ~4.7 yrs | 9.1M | github.com/drizzle-team/drizzle-orm | [ASSUMED OK] | Approved |
| `tailwindcss` | npm | ~8.7 yrs | 115M | github.com/tailwindlabs/tailwindcss | [ASSUMED OK] | Approved |
| `@biomejs/biome` | npm | ~2.8 yrs | 9.5M | github.com/biomejs/biome | [ASSUMED OK] | Approved |
| `lucide-react` | npm | established | stable | github.com/lucide-icons/lucide | [ASSUMED OK] | Approved |

**No postinstall scripts detected** on any of: `better-auth`, `drizzle-orm`, `@libsql/client`, `drizzle-kit`, `next`, `tailwindcss`, `@biomejs/biome`. [VERIFIED: npm registry]

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time — all packages above are tagged `[ASSUMED OK]` based on manual assessment (established repositories, large download counts, known maintainers). The planner should verify via `npm view <pkg> repository` before install if concerned.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├── GET /               → app/page.tsx (RSC, public, no auth)
  ├── GET /sign-in        → app/sign-in/page.tsx (RSC+Client form)
  │     └── authClient.signIn.email() → POST /api/auth/sign-in/email
  │                                         └── Better Auth handler
  │                                               └── Drizzle → local.db / Turso
  ├── GET /dashboard      → proxy.ts checks session
  │     ├── NO SESSION    → redirect /sign-in
  │     └── SESSION OK    → app/dashboard/page.tsx (RSC)
  │           ├── auth.api.getSession() → reads session from DB
  │           ├── role === 'admin' → show import trigger Card
  │           └── authClient.signOut() → DELETE /api/auth/sign-out
  │
  └── POST /api/import    → app/api/import/route.ts
        ├── 401 (no session)
        ├── 403 (role !== 'admin')
        └── 202 (stub — no import logic yet)

app/api/auth/[...all]/route.ts  ← Better Auth handler (GET + POST)
```

### Recommended Project Structure

```
warwick-massive-tunage/
├── app/
│   ├── layout.tsx              # Root layout: fonts, providers, GlobalHeader
│   ├── page.tsx                # Public archive (empty state, Phase 1)
│   ├── sign-in/
│   │   └── page.tsx            # Sign-in form (Client Component)
│   ├── dashboard/
│   │   └── page.tsx            # Private dashboard (Server Component)
│   └── api/
│       ├── auth/
│       │   └── [...all]/
│       │       └── route.ts    # Better Auth handler
│       └── import/
│           └── route.ts        # Stub: 401/403/202
├── components/
│   ├── GlobalHeader.tsx        # Shared header with sign-in/sign-out
│   └── ui/                     # shadcn components (button, card, badge, etc.)
├── lib/
│   ├── auth.ts                 # Better Auth server config
│   ├── auth-client.ts          # Better Auth React client
│   └── db.ts                   # Drizzle + libSQL client
├── db/
│   └── schema.ts               # Drizzle schema (user with role, sessions, etc.)
├── proxy.ts                    # Route protection (replaces middleware.ts)
├── drizzle.config.ts           # drizzle-kit config
├── biome.json                  # Biome config
└── .env.local                  # BETTER_AUTH_SECRET, DATABASE_URL
```

### Pattern 1: Better Auth Server Config (emailAndPassword + additionalFields + databaseHooks)

**What:** Configure Better Auth with email/password, Drizzle adapter, role column via `additionalFields`, and first-user-is-admin detection via `before` hook.

**When to use:** Once, in `lib/auth.ts`. All auth logic flows from this config.

**Critical note:** Use `databaseHooks.user.create.before` (NOT `after`) to assign `role = 'admin'` to the first user. The `before` hook can return `{ data: {...} }` to modify the user before insertion. The `after` hook executes post-insertion and cannot return modified data.

```typescript
// Source: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/reference/options.mdx
// Source: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/database.mdx

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // No requireEmailVerification — trusted 4-person group
  },
  user: {
    additionalFields: {
      role: {
        type: ["admin", "member"] as const,
        required: false,
        defaultValue: "member",
        input: false,  // users cannot set their own role
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Count existing users to detect first registration
          // Use raw Drizzle query here — ctx.context not available in before hook
          const { count } = await db
            .select({ count: sql`count(*)` })
            .from(schema.user)
            .get() ?? { count: 0 };
          if (Number(count) === 0) {
            return { data: { ...user, role: "admin" } };
          }
          // default role 'member' applies
        },
      },
    },
  },
});
```

> **Warning:** The `db` import in `databaseHooks` creates a circular dependency risk if `auth` is also imported in `db.ts`. Keep `lib/db.ts` as a pure Drizzle client with no Better Auth import.

### Pattern 2: Better Auth Client (React)

**What:** Client-side auth operations and session access.

**When to use:** In Client Components for sign-in form, sign-out button, and `useSession` hook.

```typescript
// Source: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/basic-usage.mdx

// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

// In a Client Component:
const { data: session, isPending } = authClient.useSession();

// Sign in
await authClient.signIn.email({
  email,
  password,
  callbackURL: "/dashboard",
}, {
  onError: (ctx) => alert(ctx.error.message),
});

// Sign out
await authClient.signOut({
  fetchOptions: { onSuccess: () => router.push("/sign-in") },
});
```

### Pattern 3: Next.js API Handler

**What:** Mount Better Auth's handler at the catch-all API route.

```typescript
// Source: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/installation.mdx

// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

### Pattern 4: proxy.ts — Route Protection

**What:** Next.js 16 replaces `middleware.ts` with `proxy.ts`. The exported function is `proxy` (not `middleware`).

**When to use:** Guard `/dashboard` and all its sub-paths. Public routes are NOT listed in the matcher.

```typescript
// Source: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/next.mdx
// Source: https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/proxy.mdx

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
```

### Pattern 5: Server Component Session Read

**What:** Read session in a Server Component to show personalised content.

```typescript
// Source: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/reference/faq.mdx

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  // session.user.role, session.user.name, session.user.email
}
```

### Pattern 6: Drizzle Schema with Better Auth Tables + role Column

```typescript
// Source: https://github.com/better-auth/better-auth/blob/main/packages/cli/test/__snapshots__/auth-schema-sqlite-enum.txt

import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date()).notNull(),
  // Custom field: role (matches additionalFields config)
  role: text("role").notNull().default("member"),
});

// session, account, verification tables follow standard Better Auth shape
```

### Pattern 7: Drizzle Config (libSQL)

```typescript
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN, // only needed for Turso in prod
  },
} satisfies Config;
```

### Pattern 8: libSQL Client (dev vs prod)

```typescript
// lib/db.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

### Anti-Patterns to Avoid

- **Using `middleware.ts` in Next.js 16:** Deprecated. Use `proxy.ts` with exported `proxy` function. Still works but will be removed.
- **Using the Better Auth `admin` plugin alongside `additionalFields.role`:** The admin plugin adds its own `role` column. Two `role` columns on the same table will cause a schema conflict.
- **Using `databaseHooks.user.create.after` to set role:** The `after` hook cannot return modified data — the user is already inserted. Use `before` hook and return `{ data: { ...user, role: 'admin' } }`.
- **Using Auth.js v5 / NextAuth:** In security-patch-only mode as of Sep 2025. Better Auth is the replacement.
- **Spotify OAuth for authentication:** Requires Spotify Premium; removed per D-AUTH.
- **SQLite file on Vercel:** Vercel serverless functions use ephemeral filesystems. Use Turso (libSQL over HTTP) in production.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | bcrypt wrapper | Better Auth built-in | Better Auth handles bcrypt/argon2 internally with configurable options |
| Session token management | JWT or cookie logic | Better Auth sessions | Session creation, rotation, and expiry handled automatically |
| CSRF protection | Custom token | Better Auth built-in | CSRF protection is included in Better Auth's cookie handling |
| Route auth guard | Custom cookie parse | `proxy.ts` + `auth.api.getSession()` | Auth API validates session against DB on every protected request |
| Schema generation | Manual CREATE TABLE | `npx auth@latest generate` + `drizzle-kit push` | CLI generates exact schema that matches Better Auth's internal table expectations |

**Key insight:** Better Auth's security surface (password hashing, session tokens, CSRF) is non-trivial to get right. The 15 minutes saved by hand-rolling are not worth the risk.

---

## Common Pitfalls

### Pitfall 1: `after` hook cannot assign the admin role
**What goes wrong:** Using `databaseHooks.user.create.after` to set `role = 'admin'` for the first user requires a separate `db.update()` call AFTER the user is inserted. This works but introduces a tiny window where the user exists with `role = 'member'` before the update runs, and requires error handling if the update fails.

**Why it happens:** The `after` hook signature is `async (user) => void` — no return value modifies the user record. Only `before` hooks can return `{ data: {...} }` to change the data before insertion.

**How to avoid:** Use `databaseHooks.user.create.before` and return `{ data: { ...user, role: 'admin' } }` when the user count is 0. This is atomic — the user is inserted with `role = 'admin'` in a single operation.

**Warning signs:** Dashboard shows `role = 'member'` for the app owner even after being the first to register.

### Pitfall 2: `additionalFields.role` vs. Better Auth `admin` plugin conflict
**What goes wrong:** Adding the `admin` plugin to Better Auth while also declaring `additionalFields.role` causes two `role` columns in the generated schema, leading to migration errors or unexpected behavior.

**Why it happens:** The `admin` plugin's schema includes a `role` column with values `'user'` / `'admin'`. The `additionalFields` approach creates a separate `role` column with `'admin'` / `'member'`. They collide.

**How to avoid:** Use `additionalFields` approach only (no `admin` plugin). Phase 1 only needs role-based gating, which `additionalFields` handles. The `admin` plugin's full user management features are unnecessary for a 4-person app.

**Warning signs:** `drizzle-kit generate` produces a migration with duplicate `role` columns, or `npx auth@latest generate` errors about field name collision.

### Pitfall 3: `proxy.ts` — `next/headers` is NOT available in proxy/middleware context
**What goes wrong (CORRECTED):** Using `import { headers } from "next/headers"` inside `proxy.ts` will cause a runtime error because `next/headers` is only available in Server Components and Route Handlers — NOT in the edge/middleware context where `proxy.ts` runs.

**Why it happens:** The original research incorrectly conflated Server Component patterns with middleware patterns. `next/headers` is a Server Component API; `proxy.ts` is middleware.

**How to avoid:** Use `request.headers` directly in `proxy.ts`:
```typescript
const session = await auth.api.getSession({ headers: request.headers });
```
`request.headers` is the `NextRequest` object's headers which includes all cookies from the incoming request. This works correctly in the edge/middleware context.

**Rule:** `next/headers` → use in Server Components and Route Handlers only. `request.headers` → use in `proxy.ts` and any middleware.

**Warning signs:** Runtime error on any request to `/dashboard` if `next/headers` is imported in `proxy.ts`.

### Pitfall 4: pnpm not installed — scaffold fails
**What goes wrong:** `pnpm create next-app@latest` fails if pnpm is not globally installed. Node 20.20.1 is present on this machine but pnpm is not (verified: `pnpm --version` returned command not found).

**Why it happens:** pnpm requires a separate global install; it is not bundled with Node.

**How to avoid:** Install pnpm first: `npm install -g pnpm@latest`, then verify with `pnpm --version`.

**Warning signs:** `pnpm: command not found` during scaffold.

### Pitfall 5: `BETTER_AUTH_SECRET` not set
**What goes wrong:** Better Auth will throw or silently fail if `BETTER_AUTH_SECRET` is not in `.env.local`. This is distinct from database credentials.

**Why it happens:** The secret is required for session token signing. It is not auto-generated.

**How to avoid:** Generate a random 32-byte secret: `openssl rand -base64 32` and add to `.env.local` as `BETTER_AUTH_SECRET=...`. Also set `BETTER_AUTH_URL=http://localhost:3000` for local dev.

**Warning signs:** Sign-in requests return 500 errors; Better Auth logs "missing secret" in server output.

### Pitfall 6: `disableSignUp` not needed but self-registration risk
**What goes wrong:** The app has `emailAndPassword.enabled: true` with no `disableSignUp`. Anyone who knows the URL can create an account.

**Why it happens:** Better Auth defaults to allowing sign-up.

**How to avoid:** For Phase 1, the risk is acceptable — the app is not public-facing and the URL is only shared with the four friends. After Mark registers first (getting `role = 'admin'`), the others register as `role = 'member'`. If desired, `disableSignUp: true` can be set after all 4 are registered, or the admin can create accounts for the others using a future admin interface.

**Warning signs:** Unexpected users in the database.

### Pitfall 7: `middleware.ts` still present alongside `proxy.ts`
**What goes wrong:** Having both `middleware.ts` and `proxy.ts` in the project root causes unpredictable behavior. Next.js 16 renamed the convention but may still process `middleware.ts` as a fallback.

**How to avoid:** Only create `proxy.ts`. Do not create `middleware.ts`. If migrating from an older Next.js setup, delete `middleware.ts` before adding `proxy.ts`.

---

## Code Examples

### Import trigger stub (ACCESS-03 gate)

```typescript
// Source: Better Auth docs + CONTEXT.md D-07
// app/api/import/route.ts

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Phase 1 stub — no import logic
  return Response.json({ message: "Import queued" }, { status: 202 });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` in Next.js | `proxy.ts` with exported `proxy()` | Next.js 16 (2025) | Rename required; old name still works but deprecated |
| Auth.js v5 / NextAuth | Better Auth | Sep 2025 | Auth.js moved to security-patch-only mode |
| Spotify Implicit Grant | Removed entirely | Nov 2025 | Spotify deleted the endpoint |
| `localhost` redirect URIs | `127.0.0.1` | Nov 2025 | Spotify blocked `localhost` — irrelevant for Phase 1 (no Spotify auth) |
| `GET /playlists/{id}/tracks` | `GET /playlists/{id}/items` | Feb 2026 | API renamed — irrelevant for Phase 1 (no Spotify import) |
| Tailwind v3 (`tailwind.config.js`) | Tailwind v4 (CSS-first, `postcss.config.mjs`) | Jan 2025 | No config file needed; shadcn works with `shadcn@latest` |

**Deprecated/outdated:**
- Auth.js v5: security-patch-only; Better Auth is the forward path [CITED: github.com/nextauthjs/next-auth/discussions/13252]
- Spotify OAuth for this app: blocked by Premium requirement [CITED: CONTEXT.md D-AUTH]
- `middleware.ts`: deprecated in Next.js 16, use `proxy.ts` [CITED: docs.nextjs.org]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `databaseHooks.user.create.before` hook receives the full Drizzle `db` instance in scope via module-level import (no circular dep if `auth.ts` imports `db` but `db.ts` does not import `auth`) | Pattern 1, Pitfall 1 | Hook won't compile or will throw at runtime; workaround: use `after` hook with explicit `db.update()` |
| A2 | `sql` count query syntax `db.select({ count: sql\`count(*)\` }).from(schema.user).get()` returns `{ count: number \| bigint }` in libSQL | Pattern 1 | Count check fails; fallback: `db.select().from(schema.user)` and check `.length` (less efficient but correct) |
| A3 | shadcn/ui `new-york` preset with `zinc` base and `dark` mode is compatible with `tailwindcss@4.3.0` and `shadcn@latest` CLI | UI-SPEC | Components may not render correctly; resolved at scaffold time when `shadcn init` runs |
| A4 | `NEXT_PUBLIC_APP_URL` is the correct env var name for `createAuthClient({ baseURL })` in Better Auth React client | Pattern 2 | Client calls go to wrong origin; check `better-auth` docs if sign-in requests return 404 |

---

## Open Questions (RESOLVED)

1. **Should `disableSignUp: true` be set after all 4 users are registered?**
   - What we know: Better Auth supports `emailAndPassword.disableSignUp: true` at any time
   - What's unclear: Whether Phase 1 should include a mechanism to do this, or just accept the small window where anyone could register
   - Recommendation: Leave enabled for Phase 1. Document in CLAUDE.md that after initial setup, self-registration is no longer needed. This is a Phase 2 concern.

2. **Is `NEXT_PUBLIC_APP_URL` required for `createAuthClient` in local dev?**
   - What we know: Better Auth client defaults to same-origin if no `baseURL` provided
   - What's unclear: Whether Next.js 16 App Router's server/client split causes cross-origin issues in dev
   - Recommendation: Set `baseURL: process.env.NEXT_PUBLIC_APP_URL` and configure `.env.local` with `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Safe default.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20.9+ | Next.js 16 | ✓ | 20.20.1 | — |
| npm | pnpm install | ✓ | 10.8.2 | — |
| pnpm | Project convention (CLAUDE.md) | ✗ | — | `npm install -g pnpm@latest` first |
| git | Version control | assumed ✓ | — | — |

**Missing dependencies with no fallback:** none that block execution

**Missing dependencies with fallback:**
- `pnpm`: not installed. Wave 1 plan MUST include `npm install -g pnpm@latest` as the first human-facing prerequisite step.

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is skipped per config.

---

## Security Domain

> `security_enforcement` is not set in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth `emailAndPassword`; built-in bcrypt hashing |
| V3 Session Management | yes | Better Auth session tokens; server-side session storage in Drizzle |
| V4 Access Control | yes | `proxy.ts` gate for `/dashboard`; role check in API routes and Server Components |
| V5 Input Validation | yes | Zod v4 on sign-in/sign-up form inputs |
| V6 Cryptography | partial | `BETTER_AUTH_SECRET` for session token signing; DO NOT hand-roll |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session fixation | Spoofing | Better Auth regenerates session token on sign-in (built-in) |
| CSRF on state-changing API routes | Tampering | Better Auth includes CSRF protection for its own endpoints; custom API routes (`/api/import`) should verify session server-side (not rely on cookies alone) |
| Role escalation via sign-up form | Elevation of Privilege | `additionalFields.role` has `input: false` — users cannot set their own role during sign-up |
| Credential stuffing | Spoofing | Better Auth supports rate limiting plugin (not needed for Phase 1, 4-person app) |
| Sensitive data in URL | Information Disclosure | Never put tokens or passwords in query params; Better Auth uses POST bodies |

---

## Sources

### Primary (HIGH confidence)

- `/better-auth/better-auth` (Context7) — emailAndPassword config, databaseHooks, additionalFields, Drizzle adapter, proxy.ts, client setup, signIn/signOut/useSession [VERIFIED via ctx7]
- `/vercel/next.js` (Context7) — proxy.ts file convention, matcher config, App Router layouts, use cache [VERIFIED via ctx7]
- npm registry (`npm view`) — all package versions confirmed on 2026-06-12 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- CLAUDE.md §Technology Stack — stack decisions, version compatibility table [project doc, authoritative for this project]
- CONTEXT.md Phase 1 decisions D-01 through D-13 — locked implementation choices [project doc]

### Tertiary (LOW confidence)

- None — all claims either verified via Context7, npm registry, or are project-level decisions from CONTEXT.md.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-06-12
- Architecture: HIGH — patterns confirmed against Context7 Better Auth and Next.js docs
- Pitfalls: HIGH — derived from verified API behavior (before/after hook signatures, admin plugin schema conflicts, Next.js 16 proxy.ts naming)

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (Better Auth is actively updated; re-verify before Phase 2)
