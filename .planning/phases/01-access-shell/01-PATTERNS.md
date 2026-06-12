# Phase 1: Access & Shell - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 12 new files (greenfield project — no existing codebase)
**Analogs found:** 0 / 12 (greenfield — all patterns sourced from RESEARCH.md)

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `proxy.ts` | middleware | request-response | none — greenfield | no analog |
| `lib/auth.ts` | config | request-response | none — greenfield | no analog |
| `lib/auth-client.ts` | config | request-response | none — greenfield | no analog |
| `lib/db.ts` | config | CRUD | none — greenfield | no analog |
| `db/schema.ts` | model | CRUD | none — greenfield | no analog |
| `drizzle.config.ts` | config | — | none — greenfield | no analog |
| `app/api/auth/[...all]/route.ts` | controller | request-response | none — greenfield | no analog |
| `app/api/import/route.ts` | controller | request-response | none — greenfield | no analog |
| `app/layout.tsx` | component | — | none — greenfield | no analog |
| `app/page.tsx` | component | — | none — greenfield | no analog |
| `app/sign-in/page.tsx` | component | request-response | none — greenfield | no analog |
| `app/dashboard/page.tsx` | component | request-response | none — greenfield | no analog |
| `components/GlobalHeader.tsx` | component | — | none — greenfield | no analog |

---

## Pattern Assignments

All patterns sourced from RESEARCH.md verified API documentation and official library docs (Context7, npm registry 2026-06-12).

---

### `lib/auth.ts` (config, request-response)

**Source:** RESEARCH.md Pattern 1 — Better Auth server config

**Full file pattern:**
```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

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
          // Count existing users — use before hook so data is modified atomically
          const result = await db
            .select({ count: sql`count(*)` })
            .from(schema.user)
            .get() ?? { count: 0 };
          if (Number(result.count) === 0) {
            return { data: { ...user, role: "admin" } };
          }
          // Default role 'member' applies for all subsequent users
        },
      },
    },
  },
});
```

**Critical notes:**
- Use `before` hook, NOT `after` — `before` can return `{ data: {...} }` to modify the record atomically; `after` cannot
- Do NOT add the Better Auth `admin` plugin alongside `additionalFields.role` — they produce conflicting `role` columns
- `lib/db.ts` must NOT import from `lib/auth.ts` — circular dependency risk

---

### `lib/auth-client.ts` (config, request-response)

**Source:** RESEARCH.md Pattern 2 — Better Auth React client

**Full file pattern:**
```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});
```

**Usage pattern (in Client Components):**
```typescript
// Read session
const { data: session, isPending } = authClient.useSession();

// Sign in
await authClient.signIn.email({
  email,
  password,
  callbackURL: "/dashboard",
}, {
  onError: (ctx) => setError(ctx.error.message),
});

// Sign up
await authClient.signUp.email({
  email,
  password,
  name,
}, {
  onError: (ctx) => setError(ctx.error.message),
});

// Sign out
await authClient.signOut({
  fetchOptions: { onSuccess: () => router.push("/sign-in") },
});
```

---

### `lib/db.ts` (config, CRUD)

**Source:** RESEARCH.md Pattern 8 — libSQL client (dev vs prod)

**Full file pattern:**
```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
  // authToken is undefined in local dev — @libsql/client ignores it safely
});

export const db = drizzle(client, { schema });
```

**Critical note:** Do NOT import from `lib/auth.ts` here — circular dependency would break `databaseHooks` in auth.ts.

---

### `db/schema.ts` (model, CRUD)

**Source:** RESEARCH.md Pattern 6 — Drizzle schema with Better Auth tables + role column

**Better Auth managed tables pattern:**
```typescript
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Better Auth managed table — shape matches betterauth/cli generate output
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
  // additionalFields extension — must match auth.ts additionalFields config
  role: text("role").notNull().default("member"),
});

// session, account, verification tables: standard Better Auth shape
// generated by: npx auth@latest generate --output db/schema.ts
// then manually add the role column to the user table
```

**App-domain tables pattern** (per CLAUDE.md §Database Schema Overview):
```typescript
// App-domain tables (Phase 1 defines schema; data populated in Phase 2)
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionNumber: integer("session_number").notNull().unique(),
  theme: text("theme").notNull(),
  date: integer("date", { mode: "timestamp_ms" }),  // nullable — manual input later
  description: text("description"),
});

export const contributors = sqliteTable("contributors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  initials: text("initials").notNull().unique(),  // MW, JG, JS, IT
  name: text("name").notNull(),
  userId: text("user_id").references(() => user.id),
});
```

---

### `drizzle.config.ts` (config)

**Source:** RESEARCH.md Pattern 7 — Drizzle config (libSQL)

**Full file pattern:**
```typescript
import type { Config } from "drizzle-kit";

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

---

### `proxy.ts` (middleware, request-response)

**Source:** RESEARCH.md Pattern 4 — proxy.ts route protection

**Full file pattern:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
    // Use next/headers headers(), NOT request.headers — see RESEARCH.md Pitfall 3
  });

  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
  // Public routes (/, /sign-in) are intentionally NOT in matcher — D-04
};
```

**Critical notes:**
- Export is `proxy`, NOT `middleware` — Next.js 16 renamed the convention
- Do NOT create `middleware.ts` alongside `proxy.ts` — Pitfall 7
- Use `await headers()` from `next/headers`, NOT `request.headers` — Pitfall 3

---

### `app/api/auth/[...all]/route.ts` (controller, request-response)

**Source:** RESEARCH.md Pattern 3 — Next.js API handler

**Full file pattern:**
```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

---

### `app/api/import/route.ts` (controller, request-response)

**Source:** RESEARCH.md Code Examples — import trigger stub (ACCESS-03 gate)

**Full file pattern:**
```typescript
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

  // Phase 1 stub — import logic is Phase 2
  return Response.json({ message: "Import queued" }, { status: 202 });
}
```

**Auth/role guard pattern** (applies to ALL private API routes):
```typescript
// 1. Get session
const session = await auth.api.getSession({ headers: await headers() });
// 2. Check authentication
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
// 3. Check role (admin-only routes only)
if (session.user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
```

---

### `app/dashboard/page.tsx` (component, request-response)

**Source:** RESEARCH.md Pattern 5 — Server Component session read

**Session read pattern:**
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  // session.user.role, session.user.name, session.user.email
  // proxy.ts guarantees session is non-null here — redirect already fired

  const isAdmin = session?.user.role === "admin";

  return (
    <main>
      <p>Signed in as {session?.user.name}</p>
      {isAdmin && (
        // Import trigger — admin only (D-07)
        <form action="/api/import" method="POST">
          <button type="submit">Trigger Import</button>
        </form>
      )}
      {/* Sign out handled in GlobalHeader or inline client component */}
    </main>
  );
}
```

---

### `app/sign-in/page.tsx` (component, request-response)

**Source:** RESEARCH.md Pattern 2 — Better Auth client usage

**Client Component pattern:**
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    await authClient.signIn.email(
      { email, password, callbackURL: "/dashboard" },
      { onError: (ctx) => setError(ctx.error.message) }
    );
  }

  return (
    <form onSubmit={handleSignIn}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p>{error}</p>}
      <button type="submit">Sign in</button>
    </form>
  );
}
```

---

### `app/layout.tsx` (component)

**Source:** RESEARCH.md §Recommended Project Structure + CLAUDE.md §Technology Stack

**Root layout pattern:**
```typescript
import type { Metadata } from "next";
import { GlobalHeader } from "@/components/GlobalHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Warwick Massive Tunage",
  description: "31 sessions of curated music",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GlobalHeader />
        {children}
      </body>
    </html>
  );
}
```

---

### `app/page.tsx` (component)

**Source:** RESEARCH.md D-02 — public archive with empty state; CLAUDE.md §Stack Patterns

**Caching pattern** (Next.js 16 `"use cache"` directive):
```typescript
"use cache";
import { cacheLife } from "next/cache";

export default async function ArchivePage() {
  cacheLife("days");  // Read-only data; cache aggressively per CLAUDE.md §Stack Patterns

  return (
    <main>
      <h1>Session Archive</h1>
      {/* Phase 1: empty state — Phase 2 populates with real data */}
      <p>No sessions yet.</p>
    </main>
  );
}
```

---

### `components/GlobalHeader.tsx` (component)

**Source:** RESEARCH.md D-03 — persistent "Sign in" link on all public pages; D-10 sign-out link

**Pattern notes:**
- Must be a Client Component to use `authClient.useSession()` for conditional rendering
- Shows "Sign in" link when unauthenticated (all public pages — D-03)
- Shows sign-out when authenticated

```typescript
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function GlobalHeader() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push("/sign-in") },
    });
  }

  return (
    <header>
      <Link href="/">Warwick Massive Tunage</Link>
      <nav>
        {!isPending && !session && (
          <Link href="/sign-in">Sign in</Link>
        )}
        {!isPending && session && (
          <button onClick={handleSignOut}>Sign out</button>
        )}
      </nav>
    </header>
  );
}
```

---

## Shared Patterns

### Session Read (Server Components and API Routes)
**Source:** RESEARCH.md Pattern 5 and Code Examples
**Apply to:** `app/dashboard/page.tsx`, `app/api/import/route.ts`, any future private Server Component or API route
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
```

### Auth + Role Guard (API Routes)
**Source:** RESEARCH.md Code Examples — import trigger stub
**Apply to:** `app/api/import/route.ts` and any future write-operation API route
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
if (session.user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
```

### Imports Convention
**Source:** RESEARCH.md §Recommended Project Structure + CLAUDE.md §Technology Stack
**Apply to:** All files — use `@/*` path alias (set up via `create-next-app --import-alias="@/*"`)
```typescript
// Server-side lib imports
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

// Client-side auth
import { authClient } from "@/lib/auth-client";

// Next.js server utilities
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
```

### Environment Variables Pattern
**Source:** RESEARCH.md Pitfall 5 and Pattern 8
**Apply to:** `lib/auth.ts`, `lib/db.ts`, `lib/auth-client.ts`, `drizzle.config.ts`
```
# .env.local
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=file:local.db
# DATABASE_AUTH_TOKEN — only needed for Turso in production, omit in dev
```

---

## No Analog Found

All files have no codebase analog — this is a greenfield project. Every pattern is sourced from RESEARCH.md verified documentation.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `proxy.ts` | middleware | request-response | No existing files; Next.js 16 `proxy.ts` convention |
| `lib/auth.ts` | config | request-response | No existing files; Better Auth 1.x with emailAndPassword |
| `lib/auth-client.ts` | config | request-response | No existing files |
| `lib/db.ts` | config | CRUD | No existing files; libSQL/Turso pattern |
| `db/schema.ts` | model | CRUD | No existing files; Drizzle + Better Auth table shapes |
| `drizzle.config.ts` | config | — | No existing files |
| `app/api/auth/[...all]/route.ts` | controller | request-response | No existing files |
| `app/api/import/route.ts` | controller | request-response | No existing files |
| `app/layout.tsx` | component | — | No existing files |
| `app/page.tsx` | component | — | No existing files |
| `app/sign-in/page.tsx` | component | request-response | No existing files |
| `app/dashboard/page.tsx` | component | request-response | No existing files |
| `components/GlobalHeader.tsx` | component | — | No existing files |

---

## Metadata

**Analog search scope:** Entire project directory (greenfield — no source files exist)
**Files scanned:** 0 source files (only CLAUDE.md and planning artifacts present)
**Pattern source:** RESEARCH.md (all patterns verified against Context7 + npm registry 2026-06-12)
**Pattern extraction date:** 2026-06-12
