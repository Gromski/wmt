# Phase 1: Access & Shell — Research

**Researched:** 2026-06-12
**Domain:** Next.js 16 App Router, Better Auth (Spotify OAuth), Drizzle ORM + Turso, Tailwind CSS v4, shadcn/ui
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Route Structure**
- D-01: Public archive at `/`, private dashboard at `/dashboard`. No route groups in the URL.
- D-02: The public `/` renders the full archive shell with empty state ("No sessions yet") — not a landing page. Ready for Phase 2 data to fill in without rework.
- D-03: Login entry point is a persistent header/nav "Sign in with Spotify" button present on all pages. No separate `/login` route. After OAuth callback, redirect to `/dashboard`.
- D-04: Public routes (`/` and any sub-routes under the public archive) are always accessible without authentication — no redirect to login or `/dashboard` for unauthenticated visitors.

**Admin Role Detection**
- D-05: Admin role stored as a `role` column on Better Auth's managed `users` table, extended via the Drizzle adapter. Values: `'admin'` | `'member'`. Default: `'member'`.
- D-06: First user to complete Spotify OAuth login is automatically assigned `role = 'admin'`. All subsequent logins receive `role = 'member'`. No seed script, no manual DB edit.
- D-07: Import trigger on `/dashboard` is gated to `role === 'admin'` only.

**Spotify OAuth Scope Timing**
- D-08: Request full Spotify scopes at login time: `user-read-private`, `user-read-email`, `playlist-read-private`, `playlist-read-collaborative`. One Spotify authorization prompt ever — avoids a re-auth round-trip in Phase 2.
- D-09: Import API route reads the Better Auth session to get the Spotify access token. Better Auth handles token refresh automatically (20-min expiry). No separate token persistence needed.

**Phase 1 Dashboard Shell**
- D-10: `/dashboard` in Phase 1 is minimal: connected confirmation (`Signed in as [name]`), import trigger button (stubbed — no import logic yet), and sign-out link. No nav skeleton, no empty-state sections for Sessions/Analytics.
- D-11: Date editing UI is Phase 2 scope — not stubbed in Phase 1.

### Claude's Discretion

None specified — all Phase 1 implementation decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Date editing UI — Phase 2 (ships alongside actual import pipeline)
- Apple Music / MusicKit JS integration — Phase 2 (IMPORT-07)
- Navigation skeleton with Sessions/Analytics sections — Phase 3 (when content exists to fill them)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCESS-01 | The four friends (MW, JG, JS, IT) can log in via Spotify OAuth to access the private dashboard | Better Auth Spotify social provider; PKCE via Better Auth; `/dashboard` behind proxy.ts session check |
| ACCESS-02 | The private dashboard gates import trigger, date editing, and any write operations behind authentication | proxy.ts matcher on `/dashboard/**`; Server Component `auth.api.getSession()` check; admin role gate on import trigger |
| ACCESS-03 | Admin user can trigger a re-import or sync from Spotify (and Apple Music if connected) from within the dashboard | Stubbed import button (Phase 1); POST `/api/import` route gated to `role === 'admin'`; actual logic is Phase 2 |
| ACCESS-04 | A public read-only URL exposes the session archive and analytics to anyone without login | `/` route has no auth check; proxy.ts matcher excludes `/`; public layout with no auth dependency |
</phase_requirements>

---

## Summary

Phase 1 establishes the full authenticated shell for Warwick Massive Tunage on a greenfield Next.js 16 App Router project. The core work is: scaffold the project, configure Better Auth with the Spotify social provider and Drizzle adapter, set up the Turso (libSQL) database, create `proxy.ts` to protect `/dashboard`, build the minimal public archive page at `/`, and deliver the minimal private dashboard with a stubbed import trigger.

The stack is entirely prescribed by CLAUDE.md and the locked decisions in CONTEXT.md. Better Auth is the authentication layer, using its Spotify social provider for OAuth. Drizzle ORM with the `@libsql/client` driver connects to a Turso database. The admin/member role is stored on the Better Auth `user` table via `additionalFields`. The first user to log in is promoted to admin via a server-side hook in the Better Auth `onAPICall` or database callback pattern.

One important note: the locked decision (D-05) specifies role values `'admin'` | `'member'`, but Better Auth's admin plugin defaults to `'admin'` | `'user'`. Using `additionalFields` directly (without the admin plugin) allows full control over the role string values and avoids pulling in unneeded plugin functionality. This is the recommended approach for Phase 1.

**Primary recommendation:** Scaffold with `pnpm create next-app@latest`, configure Better Auth with `additionalFields` (not the admin plugin) for custom `admin`/`member` roles, wire proxy.ts to protect only `/dashboard/**`, and enable `cacheComponents: true` in `next.config.ts` so the public `/` page can use `"use cache"` in later phases.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spotify OAuth redirect + token exchange | Frontend Server (Next.js) | — | Better Auth handles the callback at `/api/auth/[...all]` as a Next.js Route Handler; no browser-side token handling |
| Session validation (dashboard gate) | Frontend Server (proxy.ts) | API / Backend | proxy.ts checks the session cookie before rendering `/dashboard`; individual Server Actions also re-verify |
| Admin role check (import trigger) | API / Backend (Server Component + API Route) | — | Role is read from the session in the Server Component and rechecked in the POST route handler |
| Public archive page | Frontend Server (RSC) | CDN / Static | Rendered as a Server Component; can be statically cached with `"use cache"` once data exists |
| User table (role column) | Database / Storage | — | Better Auth-managed `users` table extended with `role` column via Drizzle adapter `additionalFields` |
| First-user-is-admin promotion | API / Backend | — | Runs in a Better Auth `onAPICall` or database-layer hook during the OAuth callback; never client-side |
| Spotify access token storage/refresh | Frontend Server (Better Auth) | Database / Storage | Better Auth stores tokens in its `account` table; 20-min refresh handled automatically |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.9 | Full-stack framework | App Router + RSC; proxy.ts for route protection; `"use cache"` directive [VERIFIED: npm registry] |
| `react` + `react-dom` | 19.2.x | UI runtime | Ships with Next.js 16 [VERIFIED: npm registry] |
| `typescript` | 5.x | Type safety | Auto-installed by create-next-app; required by Next.js 16 [ASSUMED] |
| `better-auth` | 1.6.17 | Authentication | Spotify social provider; Drizzle adapter; token refresh; first-class Next.js support [VERIFIED: npm registry] |
| `drizzle-orm` | 0.45.2 | ORM | SQL-close, type-safe, SQLite/libSQL support; pairs with Better Auth Drizzle adapter [VERIFIED: npm registry] |
| `@libsql/client` | 0.17.3 | Turso DB driver | Required by Drizzle for libSQL/Turso connections [VERIFIED: npm registry] |
| `drizzle-kit` | 0.31.10 | Schema migrations | CLI for generating and applying migrations [VERIFIED: npm registry] |
| `tailwindcss` | 4.3.0 | Styling | CSS-first config; required by shadcn/ui latest CLI [VERIFIED: npm registry] |
| `zod` | 4.4.3 | Input validation | API route input validation; v4 is 14x faster than v3 [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 1.17.0 | Icons | shadcn/ui default icon set; used for LogIn, Spinner icons in Phase 1 [VERIFIED: npm registry] |
| `next-themes` | 0.4.6 | Dark mode provider | Wraps app in ThemeProvider; needed to persist dark mode default from UI-SPEC [VERIFIED: npm registry] |
| `sonner` | 2.0.7 | Toast notifications | shadcn/ui uses Sonner for the `sonner` component; OAuth error toast in Phase 1 [VERIFIED: npm registry] |

### shadcn/ui Components (CLI-installed, not npm packages)

Phase 1 requires these shadcn components (per UI-SPEC):

| Component | CLI Command | Usage |
|-----------|-------------|-------|
| Button | `pnpm dlx shadcn@latest add button` | Sign-in, sign-out, import trigger |
| Avatar | `pnpm dlx shadcn@latest add avatar` | Signed-in user display in header |
| Badge | `pnpm dlx shadcn@latest add badge` | Admin role indicator |
| Separator | `pnpm dlx shadcn@latest add separator` | Dashboard section dividers |
| Card | `pnpm dlx shadcn@latest add card` | Dashboard content wrapper |
| Sonner (toast) | `pnpm dlx shadcn@latest add sonner` | OAuth error notification |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-auth` additionalFields | Better Auth admin plugin | Plugin adds role mgmt, impersonation, banning — overkill for Phase 1; default roles are `admin`/`user` not `admin`/`member` as required by D-05 |
| `proxy.ts` session check | Layout-level auth redirect | Both are valid; proxy.ts is recommended in Next.js 16 docs and runs before rendering |
| `drizzle-kit push` (dev) | `drizzle-kit migrate` (prod) | `push` is faster for dev; `migrate` runs explicit migration files and is safer in production |

**Installation:**

```bash
# 1. Scaffold (interactive — choose: TypeScript, Tailwind, App Router, src/ directory, pnpm)
npx create-next-app@latest warwick-massive-tunage

# 2. Core auth and database
pnpm add better-auth drizzle-orm @libsql/client
pnpm add -D drizzle-kit

# 3. Validation
pnpm add zod

# 4. UI support
pnpm add lucide-react next-themes sonner

# 5. shadcn/ui init (interactive — choose: New York style, zinc base, dark mode)
pnpm dlx shadcn@latest init

# 6. shadcn components for Phase 1
pnpm dlx shadcn@latest add button avatar badge separator card sonner
```

Note: `pnpm` is not currently installed on this machine (confirmed via environment check). Plans must include a pnpm install step, or use `npm` as fallback. See Environment Availability section.

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. All packages below are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.

*Manual legitimacy check performed: npm registry verified, GitHub source repos confirmed, no postinstall scripts found on any package.*

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `better-auth` | npm | ~2 yrs (Apr 2024) | High (major auth library) | github.com/better-auth/better-auth | N/A | Approved [ASSUMED] |
| `drizzle-orm` | npm | ~3 yrs | Very high (major ORM) | github.com/drizzle-team/drizzle-orm | N/A | Approved [ASSUMED] |
| `@libsql/client` | npm | ~2 yrs | High (Turso official) | github.com/tursodatabase/libsql-client-ts | N/A | Approved [ASSUMED] |
| `drizzle-kit` | npm | ~3 yrs | High | github.com/drizzle-team/drizzle-orm | N/A | Approved [ASSUMED] |
| `lucide-react` | npm | ~4 yrs | Very high | github.com/lucide-icons/lucide | N/A | Approved [ASSUMED] |
| `next-themes` | npm | ~5 yrs | Very high | github.com/pacocoursey/next-themes | N/A | Approved [ASSUMED] |
| `sonner` | npm | ~3 yrs | Very high | github.com/emilkowalski/sonner | N/A | Approved [ASSUMED] |
| `zod` | npm | ~5 yrs | Very high (industry standard) | github.com/colinhacks/zod | N/A | Approved [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time — all packages above are tagged `[ASSUMED]`. The planner should include a `checkpoint:human-verify` before the install wave, though the manual repo/age/postinstall check gives HIGH confidence these are legitimate.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  |
  |-- GET /                  --> app/(public)/page.tsx (RSC, no auth)
  |-- GET /dashboard         --> proxy.ts checks session cookie
  |                              └── session missing --> 302 to /?signin=required
  |                              └── session present --> app/(private)/dashboard/page.tsx (RSC)
  |-- GET /api/auth/[...all] --> Better Auth handler (OAuth redirect, callback, session, signout)
  |-- POST /api/import       --> Route Handler (session + role check, stubbed response in Phase 1)
  |
Better Auth OAuth Flow:
  Browser → /api/auth/signin/spotify
         → Spotify authorization (127.0.0.1 redirect URI)
         → /api/auth/callback/spotify
         → Better Auth writes user+account+session to Turso
         → First-user hook: sets role='admin' if users table was empty
         → 302 → /dashboard
  |
Database (Turso / libSQL):
  ├── user         (Better Auth managed + role column via additionalFields)
  ├── session      (Better Auth managed)
  ├── account      (Better Auth managed — stores Spotify access/refresh token)
  └── (Phase 2 tables: sessions, tracks, session_tracks, contributors)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout: ThemeProvider, global header
│   ├── page.tsx                # Public archive (empty state Phase 1)
│   ├── dashboard/
│   │   └── page.tsx            # Private dashboard (session-gated)
│   └── api/
│       ├── auth/
│       │   └── [...all]/
│       │       └── route.ts    # Better Auth handler
│       └── import/
│           └── route.ts        # Stubbed import trigger (admin only)
├── lib/
│   ├── auth.ts                 # Better Auth server config
│   ├── auth-client.ts          # Better Auth React client
│   └── db/
│       ├── index.ts            # Drizzle db instance
│       └── schema.ts           # Drizzle schema (Better Auth tables + role)
├── components/
│   ├── header.tsx              # Global header (sign-in button or avatar)
│   └── ui/                     # shadcn components (auto-generated)
└── proxy.ts                    # Route protection (Next.js 16 proxy.ts)
```

### Pattern 1: Better Auth Server Configuration with additionalFields

**What:** Configure Better Auth with Spotify OAuth provider, Drizzle adapter (SQLite/Turso), and a custom `role` field on the user table.

**When to use:** Auth config file — imported by the Route Handler and server-side session checks.

```typescript
// src/lib/auth.ts
// Source: https://www.better-auth.com/docs/authentication/spotify
//         https://www.better-auth.com/docs/adapters/drizzle
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

### Pattern 2: Next.js 16 proxy.ts for Dashboard Route Protection

**What:** Protect `/dashboard` and all its children using the `proxy` export. Public routes (`/`, `/api/auth/*`) are excluded from the matcher.

**When to use:** Created at `src/proxy.ts` (or project root `proxy.ts`). Replaces the deprecated `middleware.ts`.

```typescript
// proxy.ts
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
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

**Important:** proxy.ts cannot call `auth.api.getSession()` directly because it runs in the Edge-compatible runtime before the Node.js layer. The session cookie check is a lightweight pre-filter. The actual session validity and role are verified inside the Server Component using `auth.api.getSession({ headers: await headers() })`.

### Pattern 3: Server Component Session + Role Check

**What:** Full session verification inside a Server Component, after proxy.ts has already checked cookie presence.

**When to use:** Dashboard page Server Component and import API Route Handler.

```typescript
// src/app/dashboard/page.tsx
// Source: https://www.better-auth.com/docs/concepts/session-management
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
    // ... dashboard UI
  )
}
```

### Pattern 4: Better Auth Route Handler (Next.js App Router)

**What:** Single route handler that delegates all auth requests to Better Auth.

**When to use:** Created once at `src/app/api/auth/[...all]/route.ts`.

```typescript
// src/app/api/auth/[...all]/route.ts
// Source: https://www.better-auth.com/docs/installation
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { POST, GET } = toNextJsHandler(auth)
```

### Pattern 5: First-User-Is-Admin Hook

**What:** Automatically assign `role = 'admin'` to the first user who completes OAuth. All subsequent users receive the default `role = 'member'`.

**When to use:** Better Auth `databaseHooks.user.create.after` callback in `auth.ts`.

```typescript
// src/lib/auth.ts (addition to Pattern 1)
// Source: https://www.better-auth.com/docs/concepts/database (hooks API) [ASSUMED]
export const auth = betterAuth({
  // ... other config
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Count existing users; if this is the first, assign admin
          const count = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.user)
          const isFirst = Number(count[0]?.count ?? 0) === 1 // current user just created
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
})
```

Note: The exact `databaseHooks` API shape needs verification against Better Auth 1.6.x docs. Tag: [ASSUMED] for the hook name — the pattern is correct but the precise API key name may differ.

### Pattern 6: Drizzle DB Client for Turso

**What:** Instantiate the Drizzle client with `@libsql/client` for local SQLite (dev) and Turso HTTPS (production).

```typescript
// src/lib/db/index.ts
// Source: https://orm.drizzle.team/docs/tutorials/drizzle-with-turso
import { drizzle } from "drizzle-orm/libsql"

export const db = drizzle({
  connection: {
    url: process.env.TURSO_CONNECTION_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
```

Local dev `.env.local`:
```
TURSO_CONNECTION_URL=file:local.db
# TURSO_AUTH_TOKEN not required for local file
```

### Anti-Patterns to Avoid

- **Using `middleware.ts` instead of `proxy.ts`:** Deprecated in Next.js 16.0.0. Still works but will be removed. Use `proxy.ts` with the exported `proxy` function.
- **Using `localhost` as the Spotify redirect URI:** Spotify blocked `localhost` on 27 Nov 2025. Always use `127.0.0.1` in dev. Set `BETTER_AUTH_URL=http://127.0.0.1:3000` in `.env.local`.
- **Calling `auth.api.getSession()` in proxy.ts:** proxy.ts runs in an edge context. Full session DB lookup must happen in Server Components or Route Handlers with the Node.js runtime.
- **Relying only on proxy.ts for role gating:** proxy.ts is a first-pass cookie check. It cannot read the role. Admin gate on the import trigger must be enforced again inside the Server Component and POST route handler.
- **Using the Better Auth admin plugin for role management:** Default roles are `admin`/`user`. D-05 requires `admin`/`member`. Use `additionalFields` directly for full control over role values.
- **Using `"use cache"` on authenticated dashboard pages:** The `"use cache"` directive cannot access `cookies()` or `headers()` internally. Public pages can use it safely; dashboard pages should not use `"use cache"` at file level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth PKCE flow | Custom Spotify redirect + token exchange | Better Auth Spotify provider | PKCE requires code verifier, state param, token storage, refresh logic, concurrent request handling |
| Session cookie management | Custom JWT signing / cookie encoding | Better Auth session system | Secure HttpOnly cookies, CSRF protection, token rotation, expiry handled |
| Token refresh | Cron job or manual refresh on 401 | Better Auth automatic refresh | Spotify tokens expire in 20 min; Better Auth intercepts and refreshes transparently |
| Password hashing | bcrypt wrapper | Not applicable (OAuth-only) | No email/password auth in this project |
| Database migrations | SQL files run manually | `drizzle-kit generate` + `drizzle-kit push` | Type-safe schema diff, handles column additions, avoids drift |
| Route protection | `if (!session) redirect()` in every layout | proxy.ts matcher | Single authoritative gate; prevents flash-of-unauthenticated-content |

**Key insight:** OAuth flows, session management, and token refresh contain enough edge cases (CSRF, concurrent requests, clock drift, revoked tokens) that custom implementations reliably fail in production. Better Auth's 2+ years of production use at scale makes it the correct choice.

---

## Common Pitfalls

### Pitfall 1: localhost vs 127.0.0.1

**What goes wrong:** Spotify OAuth callback fails with "INVALID_CLIENT: Invalid redirect URI".
**Why it happens:** Spotify blocked `localhost` redirects on 27 Nov 2025. The Spotify dashboard must show `http://127.0.0.1:3000/api/auth/callback/spotify` as the allowed URI.
**How to avoid:** Set `BETTER_AUTH_URL=http://127.0.0.1:3000` in `.env.local`. Access the app via `http://127.0.0.1:3000` in the browser (not `localhost:3000`).
**Warning signs:** OAuth redirect returns to Spotify error page rather than the app.

### Pitfall 2: proxy.ts vs middleware.ts naming

**What goes wrong:** Route protection silently stops working after a Next.js version bump, or IDE warns about deprecated export.
**Why it happens:** `middleware.ts` is deprecated in Next.js 16.0.0. The file must be named `proxy.ts` and export a named `proxy` function (not `middleware`).
**How to avoid:** Create `proxy.ts` from the start. Do not run the codemod — just use `proxy.ts` directly on a greenfield project.
**Warning signs:** Next.js build warning "middleware.ts is deprecated, rename to proxy.ts".

### Pitfall 3: Role values mismatch with Better Auth admin plugin

**What goes wrong:** Better Auth admin plugin uses `'admin'`/`'user'` as fixed role strings. Application code checking for `role === 'member'` always returns false.
**Why it happens:** The admin plugin hardcodes its role strings. D-05 requires `'admin'`/`'member'`.
**How to avoid:** Do not use the admin plugin. Use `user.additionalFields` in auth config to define the `role` field with `defaultValue: 'member'`. This gives full control over the string values.
**Warning signs:** All users show `role: 'user'` in the database instead of `role: 'member'`.

### Pitfall 4: `"use cache"` requires `cacheComponents: true` in next.config.ts

**What goes wrong:** Build error: `"use cache" directive is not enabled`.
**Why it happens:** `"use cache"` is a Cache Components feature that must be explicitly opted into. It is NOT the default in Next.js 16 even though it is stable.
**How to avoid:** Add `cacheComponents: true` to `next.config.ts` on initial scaffold, before any `"use cache"` usage. Phase 1 itself doesn't use it, but Phase 3+ will — best to enable from the start.
**Warning signs:** Build fails with directive-related error on any file that contains `"use cache"`.

### Pitfall 5: proxy.ts matcher accidentally blocking static assets

**What goes wrong:** CSS, JS, and images 404 after adding proxy.ts.
**Why it happens:** Without a restrictive matcher, proxy.ts runs on every request including `_next/static`, `_next/image`, and `public/`.
**How to avoid:** Use the precise matcher `["/dashboard/:path*"]` — only protect dashboard routes. Exclude API routes from the matcher to avoid double-processing auth requests.
**Warning signs:** App loads with no styles, or images appear broken.

### Pitfall 6: Drizzle schema out of sync with Better Auth generated tables

**What goes wrong:** Better Auth CLI generates its own migration; Drizzle schema file doesn't include Better Auth tables; running `drizzle-kit push` overwrites or drops Better Auth tables.
**Why it happens:** Better Auth has its own schema generator. If the Drizzle schema.ts doesn't include Better Auth's tables, Drizzle will think they are unknown and may drop them.
**How to avoid:** After running `npx auth generate` (or `npx @better-auth/cli generate`), copy the generated table definitions into `schema.ts`. Add the `role` additionalField column to the `user` table in the same schema file. Run `drizzle-kit push` only after the schema is merged.
**Warning signs:** `drizzle-kit push` outputs "dropping table: user" or similar.

---

## Code Examples

### Environment Variables (`.env.local`)

```bash
# Better Auth
BETTER_AUTH_SECRET=<generate: openssl rand -base64 32>
BETTER_AUTH_URL=http://127.0.0.1:3000

# Spotify OAuth (from developer.spotify.com/dashboard)
SPOTIFY_CLIENT_ID=<from Spotify dashboard>
SPOTIFY_CLIENT_SECRET=<from Spotify dashboard>

# Turso (local dev uses file: URL, no token needed)
TURSO_CONNECTION_URL=file:local.db
# TURSO_AUTH_TOKEN=  # set in production only
```

### Auth Client (for Client Components)

```typescript
// src/lib/auth-client.ts
// Source: https://www.better-auth.com/docs/installation
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
})
```

### Sign-In Button (Client Component)

```typescript
// src/components/sign-in-button.tsx
"use client"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function SignInButton() {
  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "spotify",
      callbackURL: "/dashboard",
    })
  }

  return (
    <Button onClick={handleSignIn}>
      Sign in with Spotify
    </Button>
  )
}
```

### Sign-Out (Client Component)

```typescript
"use client"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push("/") },
    })
  }

  return <button onClick={handleSignOut}>Sign out</button>
}
```

### Drizzle Config

```typescript
// drizzle.config.ts
// Source: https://orm.drizzle.team/docs/tutorials/drizzle-with-turso
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export function middleware()` | `proxy.ts` + `export function proxy()` | Next.js 16.0.0 (v16.0.0) | All route protection must use proxy.ts — middleware.ts is deprecated |
| Auth.js v5 / NextAuth | Better Auth | Sep 2025 (Auth.js moved to security-patch mode) | Auth.js maintainers direct new projects to Better Auth |
| Spotify Implicit Grant Flow | PKCE flow | Nov 2025 (Spotify removed implicit grant) | Implicit grant apps stopped working 27 Nov 2025 |
| `localhost` Spotify redirect URI | `127.0.0.1` redirect URI | Nov 2025 (Spotify blocked localhost) | Dev apps must use 127.0.0.1 in browser URL and Spotify dashboard |
| `"use cache"` as experimental | `"use cache"` stable (opt-in via `cacheComponents: true`) | Next.js 16.0.0 | Stable in v16; requires `cacheComponents: true` flag in next.config.ts |

**Deprecated/outdated:**
- `middleware.ts`: Works but deprecated in Next.js 16. Will be removed in a future version. Use `proxy.ts`.
- Spotify `GET /tracks` batch endpoint: Removed in Dev Mode (Feb 2026). Not relevant for Phase 1 but critical for Phase 2.
- `@next/font`: Replaced by `next/font` (stable since Next.js 13). Use `next/font/google` for Inter.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Better Auth `databaseHooks.user.create.after` is the correct API for the first-user-is-admin promotion | Code Examples / Pattern 5 | Hook may use a different API shape in v1.6.x; need to verify in Better Auth docs before implementing |
| A2 | The Better Auth session cookie name is `better-auth.session_token` (or `__Secure-better-auth.session_token` in prod) | Pattern 2 (proxy.ts) | If cookie name differs, proxy.ts redirect check will always pass and unauthenticated users will see the dashboard page (caught by Server Component check, but produces flash) |
| A3 | `pnpm` is the intended package manager per CLAUDE.md | Installation commands | pnpm is not installed on this machine (confirmed); plans must either install pnpm first or use npm as fallback |
| A4 | All packages in the Package Legitimacy Audit are legitimate | Package Legitimacy Audit | slopcheck unavailable; manual check shows all have multi-year history, known source repos, and no postinstall scripts |
| A5 | `better-auth/adapters/drizzle` is the correct import path for the Drizzle adapter | Pattern 1 | Some docs show `@better-auth/drizzle-adapter`; verify against installed package exports |

---

## Open Questions

1. **Better Auth databaseHooks API shape**
   - What we know: Better Auth supports hooks on database operations; the general pattern exists
   - What's unclear: Exact property name (`databaseHooks`, `hooks`, `on`) and whether `after` receives the just-created user object before or after the DB write completes
   - Recommendation: Check `node_modules/better-auth/dist/index.d.ts` after install, or test with a minimal example before wiring up the first-user-admin logic

2. **proxy.ts session cookie name**
   - What we know: Better Auth uses HTTP-only session cookies
   - What's unclear: The exact cookie name (may be configurable; differs between HTTP and HTTPS)
   - Recommendation: Add a small test log in proxy.ts on first run to print `request.cookies.getAll()` and verify the cookie name, then update the check

3. **Turso free tier account setup**
   - What we know: Turso free tier is sufficient; `turso` CLI is not installed locally
   - What's unclear: Whether the plan executor will have Turso CLI access or should use the Turso web dashboard
   - Recommendation: Document both paths in the plan; local dev uses `file:local.db` and doesn't require Turso setup at all for Phase 1

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20.9+ | Next.js 16 | ✓ | v20.20.1 | — |
| npm | Package installation | ✓ | 10.8.2 | — |
| pnpm | CLAUDE.md preferred package manager | ✗ | — | Use `npm` — all pnpm commands have npm equivalents |
| turso CLI | Turso database creation | ✗ | — | Use `file:local.db` for Phase 1 (local SQLite, no Turso account needed) |
| Spotify Developer Account | Spotify OAuth credentials | Unknown | — | Phase 1 cannot be completed without a Spotify app in the developer dashboard |

**Missing dependencies with no fallback:**
- Spotify Developer Account / app credentials (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) — must be created at developer.spotify.com before OAuth can be tested

**Missing dependencies with fallback:**
- `pnpm`: Use `npm` throughout. Functionally equivalent; all `pnpm add` commands become `npm install`, `pnpm dlx` becomes `npx`.
- Turso CLI: Not needed for Phase 1. Local dev uses `file:local.db` via `TURSO_CONNECTION_URL=file:local.db`. Turso account setup is a Phase 2/3 concern (when deploying to Vercel).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth Spotify OAuth (PKCE); no email/password |
| V3 Session Management | yes | Better Auth HTTP-only session cookies; automatic token rotation |
| V4 Access Control | yes | proxy.ts (route gate) + Server Component role check (admin-only features) |
| V5 Input Validation | yes | Zod — validate API route inputs (import trigger POST body) |
| V6 Cryptography | yes | Better Auth handles token signing; `jose` deferred to Phase 2 (Apple JWT) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on sign-out | Spoofing | Better Auth uses signed session cookies; sign-out via POST, not GET |
| Session fixation after OAuth callback | Elevation of Privilege | Better Auth rotates session ID on login |
| Role bypass (member accessing admin features) | Elevation of Privilege | Double-check role in Server Component AND Route Handler — never rely solely on UI hiding |
| Stale Spotify access token surfaced to client | Information Disclosure | Tokens stored server-side in `account` table; never exposed to browser |
| Open redirect after OAuth callback | Spoofing | Better Auth validates `callbackURL` is same-origin; do not pass user-supplied redirect URLs |
| `BETTER_AUTH_SECRET` leak | Information Disclosure | Never commit to git; use `.env.local` (gitignored) |

---

## Sources

### Primary (HIGH confidence)
- `https://nextjs.org/docs/app/api-reference/file-conventions/proxy` — proxy.ts API, version history, migration guide (v16.2.9 docs, last updated 2026-05-13) [VERIFIED: official Next.js docs]
- `https://nextjs.org/docs/app/api-reference/directives/use-cache` — use cache directive, cacheComponents flag, cacheLife (v16.2.9 docs, last updated 2026-05-13) [VERIFIED: official Next.js docs]
- `https://www.better-auth.com/docs/authentication/spotify` — Spotify provider config, 127.0.0.1 redirect requirement [VERIFIED: official Better Auth docs]
- `https://www.better-auth.com/docs/installation` — Route handler setup, auth client, env vars [VERIFIED: official Better Auth docs]
- `https://www.better-auth.com/docs/adapters/drizzle` — Drizzle adapter setup, provider: "sqlite" [VERIFIED: official Better Auth docs]
- `https://www.better-auth.com/docs/concepts/session-management` — auth.api.getSession pattern, useSession hook [VERIFIED: official Better Auth docs]
- `https://www.better-auth.com/docs/concepts/database#extending-the-schema` — additionalFields API for custom user columns [VERIFIED: official Better Auth docs]
- `https://www.better-auth.com/docs/plugins/admin` — admin plugin roles (admin/user defaults), not used in Phase 1 [VERIFIED: official Better Auth docs]
- `https://orm.drizzle.team/docs/tutorials/drizzle-with-turso` — Drizzle + libSQL setup, env vars, migration commands [VERIFIED: official Drizzle docs]
- npm registry: `better-auth@1.6.17`, `drizzle-orm@0.45.2`, `@libsql/client@0.17.3`, `drizzle-kit@0.31.10`, `next@16.2.9`, `lucide-react@1.17.0`, `next-themes@0.4.6`, `sonner@2.0.7`, `zod@4.4.3` — all confirmed via `npm view` [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- CLAUDE.md §Technology Stack — stack decisions verified against npm registry and official docs
- CLAUDE.md §Spotify Integration Details — Feb 2026 API changes, 127.0.0.1 requirement

### Tertiary (LOW confidence)
- None — all claims in this research are either verified via official docs or tagged [ASSUMED] in the Assumptions Log.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry, official docs checked for Better Auth and Next.js
- Architecture: HIGH — proxy.ts pattern confirmed from official Next.js 16 docs; Better Auth route handler pattern confirmed
- Pitfalls: HIGH — localhost/127.0.0.1 confirmed from Better Auth docs; proxy.ts rename confirmed from Next.js 16 changelog
- Role/hook pattern: MEDIUM — additionalFields API confirmed; databaseHooks exact shape is ASSUMED (A1)

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (30 days — stack is relatively stable; Better Auth minor versions may change hook APIs)
