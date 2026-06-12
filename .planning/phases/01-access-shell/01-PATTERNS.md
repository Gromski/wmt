# Phase 1: Access & Shell - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 12 new files (greenfield project)
**Analogs found:** 0 / 12 — no existing source files in codebase

> This is a greenfield project. `CLAUDE.md` is the only file that exists.
> All patterns are sourced from official library documentation as captured in
> `01-RESEARCH.md`. Line number references below point to RESEARCH.md.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/lib/auth.ts` | config/service | request-response | RESEARCH.md Pattern 1 + 5 | doc-sourced |
| `src/lib/auth-client.ts` | config/service | request-response | RESEARCH.md Code Examples | doc-sourced |
| `src/lib/db/index.ts` | config | CRUD | RESEARCH.md Pattern 6 | doc-sourced |
| `src/lib/db/schema.ts` | model | CRUD | RESEARCH.md Pattern 6 + Pitfall 6 | doc-sourced |
| `proxy.ts` | middleware | request-response | RESEARCH.md Pattern 2 | doc-sourced |
| `src/app/layout.tsx` | component | request-response | RESEARCH.md Architecture | doc-sourced |
| `src/app/page.tsx` | component | request-response | RESEARCH.md Architecture | doc-sourced |
| `src/app/dashboard/page.tsx` | component | request-response | RESEARCH.md Pattern 3 | doc-sourced |
| `src/app/api/auth/[...all]/route.ts` | controller | request-response | RESEARCH.md Pattern 4 | doc-sourced |
| `src/app/api/import/route.ts` | controller | request-response | RESEARCH.md Pattern 3 (role check) | doc-sourced |
| `src/components/header.tsx` | component | request-response | RESEARCH.md Code Examples | doc-sourced |
| `drizzle.config.ts` | config | — | RESEARCH.md Code Examples | doc-sourced |

---

## Pattern Assignments

### `src/lib/auth.ts` (config/service, request-response)

**Source:** RESEARCH.md lines 243–388 (Pattern 1 + Pattern 5)
**Role:** Better Auth server instance — imported by the Route Handler, Server Components, and the first-user-is-admin hook.

**Core config pattern** (RESEARCH.md lines 247–277):
```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  socialProviders: {
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID as string,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
      scope: [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative",
      ],
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "member",
        input: false, // prevent user-supplied values
      },
    },
  },
})
```

**First-user-is-admin hook pattern** (RESEARCH.md lines 367–389):
```typescript
// Added to the betterAuth({}) config object above
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        const count = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.user)
        const isFirst = Number(count[0]?.count ?? 0) === 1
        if (isFirst) {
          await db
            .update(schema.user)
            .set({ role: "admin" })
            .where(eq(schema.user.id, user.id))
        }
      },
    },
  },
},
```

**ASSUMPTION FLAG (A1 from RESEARCH.md):** `databaseHooks.user.create.after` exact API shape needs verification against installed `better-auth@1.6.17`. Check `node_modules/better-auth/dist/index.d.ts` after install.

**Env vars required:**
```bash
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://127.0.0.1:3000
SPOTIFY_CLIENT_ID=<from Spotify dashboard>
SPOTIFY_CLIENT_SECRET=<from Spotify dashboard>
```

---

### `src/lib/auth-client.ts` (config/service, request-response)

**Source:** RESEARCH.md lines 508–516 (Code Examples — Auth Client)
**Role:** Better Auth client instance for Client Components (`"use client"`). Used in sign-in/sign-out buttons.

**Core pattern** (RESEARCH.md lines 512–515):
```typescript
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
})
```

**Env var required:**
```bash
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000   # set in .env.local for dev
```

---

### `src/lib/db/index.ts` (config, CRUD)

**Source:** RESEARCH.md lines 396–408 (Pattern 6)
**Role:** Drizzle db instance — single export, imported by `auth.ts` and any server-side Drizzle queries.

**Core pattern** (RESEARCH.md lines 401–407):
```typescript
import { drizzle } from "drizzle-orm/libsql"

export const db = drizzle({
  connection: {
    url: process.env.TURSO_CONNECTION_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
```

**Env vars:**
```bash
# Local dev (.env.local)
TURSO_CONNECTION_URL=file:local.db
# TURSO_AUTH_TOKEN not required for local file

# Production
TURSO_CONNECTION_URL=libsql://<db-name>.turso.io
TURSO_AUTH_TOKEN=<from turso dashboard>
```

---

### `src/lib/db/schema.ts` (model, CRUD)

**Source:** RESEARCH.md lines 479–484 (Pitfall 6) + CONTEXT.md lines 64–66
**Role:** Drizzle schema file. Must include Better Auth generated tables AND the `role` additionalField column on the `user` table. This is the single source of truth — `drizzle-kit push` uses it.

**Critical constraint (RESEARCH.md Pitfall 6, lines 479–484):**
Better Auth CLI (`npx @better-auth/cli generate`) produces its own table definitions.
After generation, copy those definitions into this file, then add the `role` column to the `user` table:

```typescript
// Extend Better Auth's generated user table with role column
export const user = sqliteTable("user", {
  // ... Better Auth generated columns (id, name, email, emailVerified, image, createdAt, updatedAt)
  role: text("role").notNull().default("member"),
})
```

**Do NOT run `drizzle-kit push` before merging Better Auth tables into schema.ts.**
Running it too early will drop Better Auth tables.

---

### `proxy.ts` (middleware, request-response)

**Source:** RESEARCH.md lines 288–308 (Pattern 2)
**Role:** Next.js 16 route protection. Protects `/dashboard/**` — cookie presence check only, not role check. Runs in Edge-compatible context.

**Core pattern** (RESEARCH.md lines 289–308):
```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const sessionToken =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token")

  if (!sessionToken) {
    const url = new URL("/", request.url)
    url.searchParams.set("signin", "required")
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
```

**Critical constraints:**
- File must be named `proxy.ts`, not `middleware.ts` (RESEARCH.md lines 450–455, Pitfall 2)
- Export must be named `proxy`, not `middleware`
- Do NOT call `auth.api.getSession()` here — Edge context, no Node.js runtime (RESEARCH.md lines 309–311)
- Matcher must be `["/dashboard/:path*"]` only — broader matchers break static assets (RESEARCH.md Pitfall 5)
- ASSUMPTION FLAG (A2): Cookie name `better-auth.session_token` needs verification on first run — log `request.cookies.getAll()` and confirm

---

### `src/app/layout.tsx` (component, request-response)

**Source:** RESEARCH.md lines 214–234 (Recommended Project Structure) + UI-SPEC lines 108–113
**Role:** Root layout. Wraps entire app with ThemeProvider (dark mode), Inter font, global header, Sonner toaster.

**Pattern:**
```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { Header } from "@/components/header"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Warwick Massive Tunage",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Header />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**UI-SPEC constraints (lines 108–113):**
- Header: sticky, full-width, `card` background, 1px bottom border in `border` token, height 56px
- `defaultTheme="dark"` — dark mode by default, `enableSystem={false}` to prevent override
- Sonner `<Toaster />` must be inside ThemeProvider for theme-aware toasts

---

### `src/app/page.tsx` (component, request-response)

**Source:** CONTEXT.md D-02, D-04 + UI-SPEC lines 114–119
**Role:** Public archive root. Server Component. No auth check. Empty state in Phase 1 — ready for Phase 2 data.

**Pattern:**
```typescript
// No "use cache" in Phase 1 — no data yet. Phase 3 will add "use cache" directive.
// cacheComponents: true in next.config.ts should be set now for future use (RESEARCH.md Pitfall 4).

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[720px] px-4 pt-16">
      <h1 className="text-xl font-semibold">No sessions yet</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Sessions will appear here once the archive has been imported. Check back soon.
      </p>
    </main>
  )
}
```

**Constraints:**
- No auth check, no redirect (D-04)
- Copy from UI-SPEC copywriting contract (lines 141–142)
- Do NOT add `"use cache"` directive here in Phase 1 — no data to cache (but enable the flag in `next.config.ts`)

---

### `src/app/dashboard/page.tsx` (component, request-response)

**Source:** RESEARCH.md lines 318–341 (Pattern 3) + UI-SPEC lines 120–127
**Role:** Private dashboard Server Component. Calls `auth.api.getSession()` with request headers. Redirects if no session. Renders admin-gated import trigger.

**Core pattern** (RESEARCH.md lines 322–341):
```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/")
  }

  const isAdmin = session.user.role === "admin"

  return (
    <main className="mx-auto max-w-[640px] px-4 pt-12">
      {/* Signed-in confirmation: avatar + name + admin badge */}
      {/* Import trigger card (isAdmin only) */}
      {/* Sign-out button */}
    </main>
  )
}
```

**Constraints:**
- Role check `session.user.role === "admin"` must happen here AND in the import API route (never rely on UI-only gate)
- Do NOT use `"use cache"` — this page calls `headers()` which is incompatible with the cache directive (RESEARCH.md Pitfall / Anti-pattern, lines 422–423)
- Redirect to `/` (not `/login` — there is no `/login` route, D-03)

---

### `src/app/api/auth/[...all]/route.ts` (controller, request-response)

**Source:** RESEARCH.md lines 347–355 (Pattern 4)
**Role:** Better Auth catch-all Route Handler. Delegates all `/api/auth/*` requests (OAuth redirect, callback, session, signout) to Better Auth.

**Core pattern** (RESEARCH.md lines 351–355):
```typescript
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { POST, GET } = toNextJsHandler(auth)
```

This file has no custom logic — it is a pure delegation wrapper.

---

### `src/app/api/import/route.ts` (controller, request-response)

**Source:** RESEARCH.md lines 318–341 (Pattern 3 — session+role check) + ACCESS-03 requirement
**Role:** Import trigger API route. Session check + role check (admin only). Returns stubbed response in Phase 1 — no import logic yet.

**Core pattern:**
```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Phase 1: stubbed — import logic implemented in Phase 2
  return NextResponse.json({ message: "Import triggered (stub)" }, { status: 202 })
}
```

**Constraints:**
- Must re-verify session AND role inside this handler — proxy.ts only checks cookie presence (RESEARCH.md Anti-Patterns, lines 420–421)
- Phase 1: return 202 stub; do not implement import logic

---

### `src/components/header.tsx` (component, request-response)

**Source:** RESEARCH.md lines 518–558 (Code Examples — Sign-In Button, Sign-Out) + UI-SPEC lines 108–113
**Role:** Global header rendered in root layout. Shows Sign in button (unauthenticated) or avatar+name+sign-out (authenticated). Client Component for interactivity; can use `useSession()` from auth-client.

**Sign-in button pattern** (RESEARCH.md lines 520–538):
```typescript
"use client"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

// Within sign-in handler:
await authClient.signIn.social({
  provider: "spotify",
  callbackURL: "/dashboard",
})
```

**Sign-out pattern** (RESEARCH.md lines 543–558):
```typescript
"use client"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

// Within sign-out handler:
await authClient.signOut({
  fetchOptions: { onSuccess: () => router.push("/") },
})
```

**UI-SPEC constraints (lines 108–113, 155–162):**
- Height 56px, sticky, `card` background, 1px border-bottom
- Left: "Warwick Massive Tunage" (20px semibold)
- Right: unauthenticated → Button with `LogIn` icon + "Sign in with Spotify"; authenticated → Avatar + name + "Sign out" ghost button
- Sign-in loading state: button disabled, label "Connecting…", spinner icon replaces LogIn icon
- Sign-in error: fire Sonner toast "Sign-in failed. Check your Spotify account is active and try again."

---

### `drizzle.config.ts` (config, —)

**Source:** RESEARCH.md lines 563–577 (Code Examples — Drizzle Config)

**Core pattern** (RESEARCH.md lines 567–577):
```typescript
import type { Config } from "drizzle-kit"

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_CONNECTION_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config
```

---

## Shared Patterns

### Authentication (Server-side session check)
**Source:** RESEARCH.md Pattern 3 (lines 318–341)
**Apply to:** `src/app/dashboard/page.tsx`, `src/app/api/import/route.ts`
```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const session = await auth.api.getSession({
  headers: await headers(),
})

if (!session) {
  // In Server Component: redirect("/")
  // In Route Handler: return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### Admin Role Gate
**Source:** RESEARCH.md lines 333–335 + D-07
**Apply to:** `src/app/dashboard/page.tsx` (UI gate), `src/app/api/import/route.ts` (hard gate)
```typescript
const isAdmin = session.user.role === "admin"
// Always check in BOTH the Server Component (for UI) AND the Route Handler (for enforcement)
// Never rely on UI-only hiding — the API route must enforce independently
```

### Better Auth Client (React)
**Source:** RESEARCH.md lines 512–515
**Apply to:** `src/components/header.tsx`, any future Client Components needing session
```typescript
import { authClient } from "@/lib/auth-client"
// authClient.signIn.social({ provider: "spotify", callbackURL: "/dashboard" })
// authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } })
// authClient.useSession() for reactive session state in Client Components
```

### Error Response (API Routes)
**Source:** RESEARCH.md Pattern 3 adapted for Route Handlers
**Apply to:** `src/app/api/import/route.ts` and all future API routes
```typescript
// 401 — no session
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
// 403 — wrong role
return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```

### Dark Mode Provider
**Source:** RESEARCH.md lines 97 (`next-themes@0.4.6`) + UI-SPEC lines 65–67
**Apply to:** `src/app/layout.tsx` only (set once at root)
```typescript
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
  {children}
</ThemeProvider>
```

---

## No Analog Found

All files in this phase have no existing codebase analog — this is a greenfield project.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/auth.ts` | config | request-response | No existing auth config in codebase |
| `src/lib/auth-client.ts` | config | request-response | No existing client config in codebase |
| `src/lib/db/index.ts` | config | CRUD | No existing DB layer in codebase |
| `src/lib/db/schema.ts` | model | CRUD | No existing schema in codebase |
| `proxy.ts` | middleware | request-response | No existing middleware in codebase |
| `src/app/layout.tsx` | component | request-response | No existing layouts in codebase |
| `src/app/page.tsx` | component | request-response | No existing pages in codebase |
| `src/app/dashboard/page.tsx` | component | request-response | No existing pages in codebase |
| `src/app/api/auth/[...all]/route.ts` | controller | request-response | No existing route handlers in codebase |
| `src/app/api/import/route.ts` | controller | request-response | No existing route handlers in codebase |
| `src/components/header.tsx` | component | request-response | No existing components in codebase |
| `drizzle.config.ts` | config | — | No existing config in codebase |

All patterns sourced from official library documentation referenced in `01-RESEARCH.md`.

---

## Critical Anti-Patterns (from RESEARCH.md)

These must be avoided and are referenced here for the planner to include as constraints in task actions:

| Anti-Pattern | Correct Pattern | RESEARCH.md Reference |
|---|---|---|
| `middleware.ts` with `export function middleware()` | `proxy.ts` with `export function proxy()` | Pitfall 2, lines 450–455 |
| `localhost` as Spotify redirect URI | `127.0.0.1` (set `BETTER_AUTH_URL=http://127.0.0.1:3000`) | Pitfall 1, lines 444–449 |
| `auth.api.getSession()` inside `proxy.ts` | Session DB check only in Server Components / Route Handlers | Anti-patterns, lines 419–420 |
| Relying only on proxy.ts for role gate | Re-check role in Server Component AND Route Handler | Anti-patterns, lines 420–421 |
| Using Better Auth admin plugin (roles: admin/user) | `additionalFields` with `defaultValue: "member"` | Pitfall 3, lines 457–463 |
| `"use cache"` on dashboard page | Never use `"use cache"` on pages calling `headers()` or `cookies()` | Anti-patterns, lines 422–423 |
| Running `drizzle-kit push` before merging Better Auth tables | Merge Better Auth generated tables into schema.ts first | Pitfall 6, lines 479–484 |

---

## Metadata

**Analog search scope:** Entire project root (only `CLAUDE.md` exists)
**Files scanned:** 1 (`CLAUDE.md`) + 3 planning files (`01-CONTEXT.md`, `01-RESEARCH.md`, `01-UI-SPEC.md`)
**Analog matches:** 0 — greenfield project, all patterns from official library docs
**Pattern extraction date:** 2026-06-12
**Pattern source confidence:** HIGH (all from official Next.js 16, Better Auth, Drizzle docs as verified in RESEARCH.md)
