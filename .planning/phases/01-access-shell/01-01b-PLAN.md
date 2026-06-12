---
phase: 01-access-shell
plan: 01b
type: execute
wave: 2
depends_on:
  - 01-01
files_modified:
  - src/lib/db/index.ts
  - src/lib/db/schema.ts
  - src/lib/auth.ts
  - src/lib/auth-client.ts
  - src/app/api/auth/[...all]/route.ts
  - drizzle.config.ts
  - drizzle/
  - proxy.ts
  - src/app/layout.tsx
  - src/app/page.tsx
  - local.db
autonomous: false
requirements:
  - ACCESS-01
  - ACCESS-04
must_haves:
  truths:
    - "Running `npm run dev` boots the app on http://127.0.0.1:3000 with no errors"
    - "GET / returns 200 and renders the empty-state archive shell ('No sessions yet') without any auth check"
    - "GET /api/auth/session returns a JSON body (Better Auth handler responds, even if session is null)"
    - "The local SQLite file (local.db) exists with Better Auth tables (user, session, account, verification) AND the role column on user with default 'member'"
    - "An unauthenticated request to /dashboard is redirected to /?signin=required by proxy.ts (cookie-presence check)"
    - "A request to / passes through proxy.ts untouched (matcher scopes only to /dashboard/:path*)"
  artifacts:
    - path: src/lib/auth.ts
      provides: "Better Auth server instance with Spotify provider, Drizzle adapter, role additionalField, first-user-is-admin hook"
      contains: "betterAuth("
    - path: src/lib/auth-client.ts
      provides: "Better Auth React client for Client Components"
      contains: "createAuthClient"
    - path: src/lib/db/schema.ts
      provides: "Drizzle schema with Better Auth tables (user, session, account, verification) plus role column on user"
      contains: "role"
    - path: src/lib/db/index.ts
      provides: "Drizzle db instance backed by libSQL"
      contains: "drizzle"
    - path: src/app/page.tsx
      provides: "Public archive empty-state page (no auth check, ready for Phase 2 data)"
      contains: "No sessions yet"
    - path: src/app/layout.tsx
      provides: "Root layout with Inter font, ThemeProvider (dark default), Toaster, Plan 02 header seam"
      contains: "ThemeProvider"
    - path: src/app/api/auth/[...all]/route.ts
      provides: "Better Auth catch-all route handler for /api/auth/*"
      contains: "toNextJsHandler"
    - path: drizzle.config.ts
      provides: "Drizzle Kit config pointing at libSQL with schema path src/lib/db/schema.ts"
      contains: 'dialect: "turso"'
    - path: proxy.ts
      provides: "Next.js 16 route gate — cookie-presence check on /dashboard/:path* redirects to /?signin=required"
      contains: "export function proxy"
    - path: local.db
      provides: "Local SQLite database with the four Better Auth tables live (created by drizzle-kit push in Task 5)"
      contains: ""
  key_links:
    - from: src/lib/auth.ts
      to: src/lib/db/index.ts
      via: "drizzleAdapter(db, { provider: 'sqlite' })"
      pattern: "drizzleAdapter\\(db"
    - from: src/app/api/auth/[...all]/route.ts
      to: src/lib/auth.ts
      via: "toNextJsHandler(auth)"
      pattern: "toNextJsHandler\\(auth\\)"
    - from: drizzle.config.ts
      to: src/lib/db/schema.ts
      via: 'schema: "./src/lib/db/schema.ts"'
      pattern: "src/lib/db/schema.ts"
    - from: proxy.ts
      to: "/dashboard route (Plan 02)"
      via: "matcher /dashboard/:path* — redirects to /?signin=required if no session cookie"
      pattern: "matcher.*dashboard"
---

## Phase Goal

**As a** Warwick session friend (MW, JG, JS, or IT), **I want to** sign in with Spotify and reach a private dashboard while the public archive page stays open to anyone, **so that** the four of us can use authenticated tools without locking visitors out of the read-only archive.

> Plan 01b of 4 — Walking Skeleton wiring. Picks up where Plan 01-01 (scaffold) left off: writes the Drizzle schema, configures Better Auth with the Spotify provider + role + first-user-is-admin hook, installs `proxy.ts` for `/dashboard` route protection (moved from Plan 01-02 for cohesion — proxy.ts depends on the auth cookie contract established here), builds the public archive empty-state page and root layout, runs the BLOCKING `drizzle-kit push`, and human-verifies the dev server boots.
>
> Split rationale: created from the back half of the original Plan 01-01 to bring it under the ≤5 auto-task threshold. proxy.ts moved from Plan 01-02 because the cookie name contract it consumes is established by `src/lib/auth.ts` in Task 2 of this plan — keeping them together prevents a cross-plan dependency on an unverified cookie name.

<objective>
Wire the Walking Skeleton on top of Plan 01-01's scaffold: hand-write the Drizzle schema with the Better Auth core tables plus the `role: 'admin' | 'member'` additionalField column (D-05); configure Better Auth with the Spotify provider requesting the four scopes locked in D-08 and the first-user-is-admin database hook (D-06); install `proxy.ts` at project root with the cookie-presence check on `/dashboard/:path*` (D-03, D-04); build the public archive empty state (D-02, D-04, ACCESS-04) and root layout with dark-default ThemeProvider; mount the Better Auth catch-all route handler; push the schema to local SQLite; human-verify the dev server boots end-to-end.

Purpose: Complete the Walking Skeleton's foundation so that `npm run dev` boots, `GET /` renders without auth, `GET /api/auth/session` responds, the local DB has the right shape, and unauthenticated `/dashboard` requests are gated by proxy.ts ready for Plan 02 to layer the OAuth UI on top.

Output: Working Next.js project with the schema live, auth configured, proxy gate installed, and public empty-state page rendering. After this plan, Plan 02 wires the header + sign-in/sign-out + dashboard Server Component to complete the end-to-end OAuth round trip.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-access-shell/01-CONTEXT.md
@.planning/phases/01-access-shell/01-RESEARCH.md
@.planning/phases/01-access-shell/01-PATTERNS.md
@.planning/phases/01-access-shell/01-UI-SPEC.md
@.planning/phases/01-access-shell/SKELETON.md
@.planning/phases/01-access-shell/01-01-SUMMARY.md
</context>

<interfaces>
Contracts inherited from Plan 01-01 (already exist after Plan 01-01 ships):
- `.env.local` populated with `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://127.0.0.1:3000`, `SPOTIFY_CLIENT_ID/SECRET`, `TURSO_CONNECTION_URL=file:local.db`, `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000`
- `package.json` pinned at `better-auth@1.6.17`, `drizzle-orm@0.45.2`, `@libsql/client@0.17.3`, `drizzle-kit@0.31.10`
- shadcn primitives vendored under `src/components/ui/` (button, avatar, badge, separator, card, sonner)
- `src/app/globals.css` has violet `--primary` (262 83% 58%) override

Contracts produced by this plan that Plans 02 and 03 consume:

`src/lib/auth.ts` — exports `auth` with these consumer-facing affordances:
- `auth.api.getSession({ headers: await headers() })` returns either `null` or `{ user: { id, email, name, image, role }, session: { ... } }`. `user.role` is the custom `additionalField` defined here with values `'admin'` or `'member'` (default `'member'`).
- `auth.handler` is wrapped by `toNextJsHandler` and exported through the route handler.

`src/lib/auth-client.ts` — exports `authClient` with:
- `authClient.signIn.social({ provider: "spotify", callbackURL: "/dashboard" })`
- `authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } })`
- `authClient.useSession()` returning `{ data, isPending, error }`

`src/lib/db/schema.ts` — exports tables `user`, `session`, `account`, `verification`. `user` has the additional column `role: text("role").notNull().default("member")`.

`src/lib/db/index.ts` — exports `db` (Drizzle libSQL instance) for use anywhere on the server.

`proxy.ts` (project root) — exports a named `proxy` function and `config = { matcher: ["/dashboard/:path*"] }`. Plan 02 dashboard relies on this gate redirecting unauth visitors to `/?signin=required` and then re-validates via the Server Component as defense-in-depth.

Cookie contract:
- Better Auth session cookie name: `better-auth.session_token` (HTTP) or `__Secure-better-auth.session_token` (HTTPS). RESEARCH Assumption A2 flags this for confirmation — proxy.ts checks BOTH and the dev-mode log surfaces the actual name observed.
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Drizzle schema with Better Auth tables and role column</name>
  <files>
    - src/lib/db/index.ts
    - src/lib/db/schema.ts
    - drizzle.config.ts
  </files>
  <read_first>
    - .planning/phases/01-access-shell/01-RESEARCH.md (lines 394-414 Pattern 6; lines 478-484 Pitfall 6; lines 563-577 drizzle.config.ts example)
    - .planning/phases/01-access-shell/01-PATTERNS.md (lines 130-178 schema + db client patterns)
    - .planning/phases/01-access-shell/01-CONTEXT.md (D-05: role values are 'admin' | 'member' with default 'member')
    - node_modules/better-auth/dist/index.d.ts (installed by Plan 01-01 — confirm `additionalFields` typing)
  </read_first>
  <action>
    Create `src/lib/db/index.ts` exporting a `db` constant constructed via `drizzle({ connection: { url: process.env.TURSO_CONNECTION_URL!, authToken: process.env.TURSO_AUTH_TOKEN } })` imported from `drizzle-orm/libsql`. Pass the schema as a second argument: `drizzle({ ... }, { schema })` after the schema file exists, importing `* as schema` from `./schema`.

    Create `src/lib/db/schema.ts` with the Better Auth core tables hand-written (do NOT run `npx @better-auth/cli generate` — RESEARCH A1 flags its API as not fully verified; hand-write per documented shape to keep this plan deterministic). Use `sqliteTable` from `drizzle-orm/sqlite-core`. Required tables and columns (use these EXACT names and types — Better Auth maps them by convention):

    - `user`: id text PK, name text NOT NULL, email text NOT NULL UNIQUE, emailVerified integer NOT NULL DEFAULT 0 (boolean as int), image text NULLABLE, createdAt integer NOT NULL (timestamp_ms mode), updatedAt integer NOT NULL (timestamp_ms mode), **role text NOT NULL DEFAULT 'member'** (the D-05 additionalField column)
    - `session`: id text PK, userId text NOT NULL REFERENCES user(id) ON DELETE CASCADE, token text NOT NULL UNIQUE, expiresAt integer NOT NULL, ipAddress text NULLABLE, userAgent text NULLABLE, createdAt integer NOT NULL, updatedAt integer NOT NULL
    - `account`: id text PK, userId text NOT NULL REFERENCES user(id) ON DELETE CASCADE, accountId text NOT NULL, providerId text NOT NULL, accessToken text NULLABLE, refreshToken text NULLABLE, accessTokenExpiresAt integer NULLABLE, refreshTokenExpiresAt integer NULLABLE, scope text NULLABLE, idToken text NULLABLE, password text NULLABLE, createdAt integer NOT NULL, updatedAt integer NOT NULL
    - `verification`: id text PK, identifier text NOT NULL, value text NOT NULL, expiresAt integer NOT NULL, createdAt integer NOT NULL, updatedAt integer NOT NULL

    Export each table by name (`export const user = ...`). Do not declare relations in Phase 1 — not required by Better Auth runtime.

    Create `drizzle.config.ts` at project root with: `schema: "./src/lib/db/schema.ts"`, `out: "./drizzle"`, `dialect: "turso"`, `dbCredentials: { url: process.env.TURSO_CONNECTION_URL!, authToken: process.env.TURSO_AUTH_TOKEN }`. Wrap with `satisfies Config` imported from `drizzle-kit`.

    DO NOT run `drizzle-kit push` in this task — that is Task 5 (BLOCKING schema push). Pitfall 6 explicitly warns against pushing before the schema is complete.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tee /tmp/wmt-tsc.log; grep -E "error TS" /tmp/wmt-tsc.log | wc -l | awk '$1 == 0 { exit 0 } { exit 1 }'</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/db/schema.ts` exports four tables: `user`, `session`, `account`, `verification` — verify with `grep -E '^export const (user|session|account|verification) =' src/lib/db/schema.ts | wc -l` equals 4
    - `src/lib/db/schema.ts` contains the literal `text("role").notNull().default("member")` (D-05 — role text NOT NULL DEFAULT 'member')
    - `src/lib/db/index.ts` imports from `drizzle-orm/libsql` and exports `db`
    - `drizzle.config.ts` exists at project root with `dialect: "turso"` and `schema: "./src/lib/db/schema.ts"`
    - `npx tsc --noEmit` reports zero errors
  </acceptance_criteria>
  <done>Drizzle schema authored with Better Auth tables plus the role additionalField column, db client wired, drizzle.config.ts at project root, all type-checks pass. Ready for the BLOCKING schema push in Task 5.</done>
</task>

<task type="auto">
  <name>Task 2: Better Auth server config with Spotify provider + first-user-is-admin hook</name>
  <files>
    - src/lib/auth.ts
    - src/lib/auth-client.ts
    - src/app/api/auth/[...all]/route.ts
  </files>
  <read_first>
    - src/lib/db/schema.ts (from Task 1)
    - src/lib/db/index.ts (from Task 1)
    - .planning/phases/01-access-shell/01-RESEARCH.md (lines 237-389 Patterns 1-5; lines 508-558 client + sign-in/out examples; lines 599-606 Assumption A1 about databaseHooks)
    - .planning/phases/01-access-shell/01-PATTERNS.md (lines 33-128 auth + auth-client patterns)
    - .planning/phases/01-access-shell/01-CONTEXT.md (D-05 role values; D-06 first-user rule; D-08 Spotify scopes; D-09 Better Auth handles refresh)
    - node_modules/better-auth/dist/index.d.ts and node_modules/better-auth/dist/adapters/drizzle/index.d.ts (confirm: hooks API key name, drizzleAdapter import path, additionalFields shape)
  </read_first>
  <action>
    Create `src/lib/auth.ts`:
    - Import `betterAuth` from `better-auth` and `drizzleAdapter` from `better-auth/adapters/drizzle` (verify path against installed types — RESEARCH A5 flags this; fall back to `@better-auth/drizzle-adapter` if the types disagree).
    - Import `db` from `./db` and `* as schema` from `./db/schema`.
    - Import `sql`, `eq` from `drizzle-orm`.
    - Call `betterAuth({ ... })` with: `database: drizzleAdapter(db, { provider: "sqlite", schema })`; `socialProviders.spotify` with `clientId`/`clientSecret` from env and `scope: ["user-read-private", "user-read-email", "playlist-read-private", "playlist-read-collaborative"]` (D-08 exact list — do not abbreviate).
    - `user.additionalFields.role: { type: "string", required: false, defaultValue: "member", input: false }` (D-05; `input: false` prevents user-supplied role injection — STRIDE Elevation of Privilege mitigation).
    - `databaseHooks.user.create.after: async (user) => { ... }` implementing D-06: query `db.select({ count: sql<number>\`count(*)\` }).from(schema.user)`, if the count equals 1 (the just-created user is the first), `db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, user.id))`. Wrap in try/catch and log to console.error on failure so an unexpected hook signature does not break the entire sign-in flow — flag the assumption with a `// ASSUMPTION A1` comment per RESEARCH Assumptions Log.
    - Export `auth` as a named const.

    Create `src/lib/auth-client.ts`:
    - Import `createAuthClient` from `better-auth/react`.
    - Export `authClient = createAuthClient({ baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000" })`.

    Create `src/app/api/auth/[...all]/route.ts`:
    - Import `auth` from `@/lib/auth` and `toNextJsHandler` from `better-auth/next-js`.
    - Export `const { POST, GET } = toNextJsHandler(auth)`. No custom logic.

    Verify each file is referenced correctly via the `@/*` alias. Do NOT write `src/components/header.tsx`, `src/app/dashboard/page.tsx`, or `src/app/api/import/route.ts` here — those belong to Plans 02 and 03.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tee /tmp/wmt-tsc2.log; grep -E "error TS" /tmp/wmt-tsc2.log | wc -l | awk '$1 == 0 { exit 0 } { exit 1 }'</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/auth.ts` exists and exports `auth`; `grep -c 'export const auth' src/lib/auth.ts` ≥ 1
    - `src/lib/auth.ts` contains the literal string `playlist-read-collaborative` (D-08 — the longest of the four scopes; presence confirms full list)
    - `src/lib/auth.ts` contains the literal `defaultValue: "member"` (D-05)
    - `src/lib/auth.ts` contains the literal `databaseHooks` AND a comment containing `ASSUMPTION A1`
    - `src/lib/auth-client.ts` exists and exports `authClient`
    - `src/lib/auth-client.ts` references `127.0.0.1` (no `localhost`)
    - `src/app/api/auth/[...all]/route.ts` exports both `POST` and `GET` via `toNextJsHandler`
    - `npx tsc --noEmit` reports zero errors
  </acceptance_criteria>
  <done>Better Auth wired with Spotify provider + four scopes (D-08), role additionalField (D-05), first-user-is-admin hook (D-06) with assumption flag, React client, and catch-all route handler. Type checks pass. The cookie name contract this auth instance produces is now consumed by proxy.ts in Task 3.</done>
</task>

<task type="auto">
  <name>Task 3: proxy.ts route protection on /dashboard (moved from Plan 01-02 for cohesion)</name>
  <files>
    - proxy.ts
  </files>
  <read_first>
    - src/lib/auth.ts (from Task 2 — establishes the cookie contract this proxy consumes)
    - .planning/phases/01-access-shell/01-RESEARCH.md (lines 282-311 Pattern 2; lines 450-455 Pitfall 2 — file MUST be named proxy.ts; lines 470-478 Pitfall 5 — matcher must be precise; lines 600-606 Assumption A2 — cookie name)
    - .planning/phases/01-access-shell/01-PATTERNS.md (lines 182-217 proxy.ts pattern)
    - .planning/phases/01-access-shell/01-CONTEXT.md (D-03 redirect to / not /login; D-04 public routes NEVER redirect)
  </read_first>
  <action>
    This task was moved from Plan 01-02 Task 2 during revision iteration 2. Rationale: proxy.ts consumes the Better Auth session cookie name contract established by `src/lib/auth.ts` in Task 2 above — keeping them together means the cookie contract and its consumer ship in the same plan and the same wave, eliminating a cross-plan dependency on an unverified cookie name.

    Create `proxy.ts` at the project ROOT (not under src/) — Next.js 16 file convention requires it at project root or src/ root; per the existing project structure (src/ directory exists), place it at the project root.

    File contents:
    - Import `NextResponse` from `next/server` and `type { NextRequest }` from `next/server`.
    - Export a NAMED `proxy` function (NOT `middleware` — Pitfall 2) taking `(request: NextRequest)`.
    - Inside: read both candidate cookies via `request.cookies.get("better-auth.session_token")` and `request.cookies.get("__Secure-better-auth.session_token")` (Assumption A2 — cookie name may differ). Take the first truthy one.
    - If neither cookie is present, construct `const url = new URL("/", request.url); url.searchParams.set("signin", "required"); return NextResponse.redirect(url);` — redirects unauth visitors to `/?signin=required` per RESEARCH Pattern 2.
    - Otherwise `return NextResponse.next();`.
    - DO NOT call `auth.api.getSession()` here — proxy.ts runs in Edge runtime without DB access (Anti-pattern lines 419-421). Cookie presence only.
    - Export `const config = { matcher: ["/dashboard/:path*"] };` — protects ONLY /dashboard and its children (Pitfall 5 — broader matcher would block static assets and break the app).

    Add a one-line `console.log("proxy.ts cookie names seen:", Array.from(request.cookies.getAll().map(c => c.name)));` BEFORE the cookie check, gated behind `if (process.env.NODE_ENV === "development")` — this lets the developer confirm the actual cookie name during Plan 02's human-verify (resolves Assumption A2). Remove after Phase 1 (a Phase 2 cleanup task can strip this; for now it lives behind the env guard so it never logs in production).

    Note: this task does NOT exercise the proxy — Plan 02's human-verify is the first time a real `/dashboard` request hits it. The Task 6 dev-server verify in this plan only confirms `npm run dev` boots and `/` (which is OUTSIDE the matcher) renders untouched.
  </action>
  <verify>
    <automated>test -f proxy.ts && grep -q "export function proxy" proxy.ts && grep -q 'matcher: \["/dashboard/:path\*"\]' proxy.ts && ! grep -q "middleware" proxy.ts && ! grep -q 'auth\.api\.getSession' proxy.ts && npx tsc --noEmit 2>&1 | grep -E "error TS" | wc -l | awk '$1 == 0 { exit 0 } { exit 1 }'</automated>
  </verify>
  <acceptance_criteria>
    - `proxy.ts` exists at project root (NOT under src/) — `test -f proxy.ts` succeeds; `test ! -f src/proxy.ts` also true (the file is at project root only)
    - File contains `export function proxy(` (not `middleware`)
    - File contains the exact matcher `["/dashboard/:path*"]` — `grep -q 'matcher: \["/dashboard/:path\*"\]' proxy.ts`
    - File does NOT contain `auth.api.getSession` (Anti-pattern lines 419-421)
    - File does NOT contain the word `middleware` anywhere (Pitfall 2)
    - File contains a guarded dev-mode log of cookie names (Assumption A2 resolution aid)
    - File checks BOTH `better-auth.session_token` AND `__Secure-better-auth.session_token` — `grep -c "session_token" proxy.ts` ≥ 2
    - `npx tsc --noEmit` zero errors
  </acceptance_criteria>
  <done>proxy.ts protects `/dashboard/:path*` only; unauth visitors redirected to `/?signin=required` (verified live in Plan 02 Task 5); public `/` is untouched; cookie name assumption A2 will be confirmed when Plan 02 exercises the OAuth flow.</done>
</task>

<task type="auto">
  <name>Task 4: Public archive page and root layout shell</name>
  <files>
    - src/app/layout.tsx
    - src/app/page.tsx
  </files>
  <read_first>
    - .planning/phases/01-access-shell/01-UI-SPEC.md (lines 50-86 typography + color; lines 108-119 layout contract; lines 141-143 copywriting)
    - .planning/phases/01-access-shell/01-PATTERNS.md (lines 220-292 layout + page patterns)
    - .planning/phases/01-access-shell/01-CONTEXT.md (D-02 public archive renders full shell with empty state; D-04 no auth check on `/`)
    - src/app/globals.css (from Plan 01-01 Task 4 — confirm violet `--primary`)
  </read_first>
  <action>
    Overwrite `src/app/layout.tsx` (the create-next-app default) with the root layout per UI-SPEC §Layout Contract and PATTERNS lines 226-256:
    - Import `Inter` from `next/font/google` and instantiate `inter = Inter({ subsets: ["latin"] })`.
    - Import `ThemeProvider` from `next-themes`.
    - Import `Toaster` from `@/components/ui/sonner`.
    - Export `metadata: Metadata = { title: "Warwick Massive Tunage" }` (D-10).
    - Default export `RootLayout({ children })` returning `<html lang="en" suppressHydrationWarning><body className={inter.className}><ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>{children}<Toaster /></ThemeProvider></body></html>`.
    - DO NOT add a `<Header />` here yet — Plan 02 owns the header component and inserts it. Leave a `{/* Header inserted in Plan 02 */}` comment in place where the header will go.
    - Keep the `import "./globals.css"` line at the top.

    Overwrite `src/app/page.tsx` with the public archive empty-state per UI-SPEC §Public Archive (D-02, D-04, ACCESS-04):
    - No `"use client"` directive (Server Component).
    - No `"use cache"` directive in Phase 1 (RESEARCH Pitfall 4 + Anti-pattern; Phase 3 adds it when real data exists).
    - No call to `auth.api.getSession()` here — D-04 prohibits auth checks on `/`.
    - Return `<main className="mx-auto max-w-[720px] px-4 pt-16">` (max-width 720px, top padding 64px = 3xl token) containing `<h1 className="text-xl font-semibold">No sessions yet</h1>` and `<p className="mt-2 text-base text-muted-foreground">Sessions will appear here once the archive has been imported. Check back soon.</p>` (copy verbatim from UI-SPEC line 142-143).

    Confirm `src/app/globals.css` still contains the Tailwind directives (`@import "tailwindcss"` for v4) and the violet `--primary` override from Plan 01-01.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tee /tmp/wmt-build7.log; tail -5 /tmp/wmt-build7.log | grep -E "Compiled successfully|✓ Compiled"</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/layout.tsx` imports `next/font/google` AND `next-themes` AND `@/components/ui/sonner`
    - `src/app/layout.tsx` contains the literal `defaultTheme="dark"` and `enableSystem={false}`
    - `src/app/layout.tsx` does NOT import or render a Header component yet (Plan 02 owns that)
    - `src/app/page.tsx` does NOT contain the strings `getSession`, `redirect(`, `auth.`, `headers()`, or `"use cache"` (D-04 — no auth on public route)
    - `src/app/page.tsx` contains both literal strings: `No sessions yet` AND `Sessions will appear here once the archive has been imported. Check back soon.` (UI-SPEC line 142-143)
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Public archive empty-state page renders without auth; root layout wired with dark-by-default ThemeProvider + Sonner toaster, with a clear seam for Plan 02 to insert the header.</done>
</task>

<task type="auto">
  <name>Task 5: [BLOCKING] Push schema to local SQLite</name>
  <files>
    - drizzle/ (migration snapshot directory created by drizzle-kit)
    - local.db (created at project root by libSQL driver on first connect)
  </files>
  <read_first>
    - drizzle.config.ts (from Task 1)
    - src/lib/db/schema.ts (from Task 1)
    - .planning/phases/01-access-shell/01-RESEARCH.md (lines 478-484 Pitfall 6 — schema must be merged BEFORE push)
  </read_first>
  <action>
    Run `npx drizzle-kit push` from the project root. This is the BLOCKING schema push required by `<schema_push_requirement>` — without it, the database has no tables and Better Auth will fail at the first `db.select` call even though build and type-check pass (the types come from schema.ts, not the live database).

    drizzle-kit push will:
    1. Read schema.ts via drizzle.config.ts.
    2. Connect to `file:local.db` (created on first connect — no Turso account needed for Phase 1).
    3. Emit CREATE TABLE statements for `user`, `session`, `account`, `verification` (including the `role` column on `user` with `DEFAULT 'member'`).
    4. The command is non-interactive when pushing to an empty database. If it prompts about any "data loss" warning (it should not for a fresh DB), abort and investigate Pitfall 6.

    After the push, verify the tables exist by running a one-line probe: `node -e "const { drizzle } = require('drizzle-orm/libsql'); const { sql } = require('drizzle-orm'); const db = drizzle({ connection: { url: 'file:local.db' } }); db.run(sql\`SELECT name FROM sqlite_master WHERE type='table'\`).then(r => { console.log(JSON.stringify(r.rows)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });"` and confirm the output contains all four table names.

    Confirm the `role` column exists with the correct default by running `sqlite3 local.db "SELECT sql FROM sqlite_master WHERE name='user';"` and checking the CREATE TABLE statement contains `role TEXT NOT NULL DEFAULT 'member'`.

    Note for the executor: this task is marked autonomous but is `[BLOCKING]` in the plan-level sense — verification of the phase CANNOT pass until this push has run successfully. If `sqlite3` CLI is not available, fall back to the Node probe above; both succeed proves the schema is live.
  </action>
  <verify>
    <automated>test -f local.db && node -e "const { drizzle } = require('drizzle-orm/libsql'); const { sql } = require('drizzle-orm'); const db = drizzle({ connection: { url: 'file:local.db' } }); db.run(sql\`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\`).then(r => { const names = r.rows.map(x => x.name).join(','); if (names.includes('user') && names.includes('session') && names.includes('account') && names.includes('verification')) { process.exit(0); } else { console.error('missing tables, got:', names); process.exit(1); } });"</automated>
  </verify>
  <acceptance_criteria>
    - `local.db` exists at project root (sized > 0 bytes)
    - The four tables (`user`, `session`, `account`, `verification`) exist in `local.db`
    - The `user` table's CREATE statement contains both `role` AND `'member'` (the D-05 default)
    - `drizzle-kit push` exited 0 with no "data loss" warnings
  </acceptance_criteria>
  <done>Local SQLite database has the full schema live and ready for Better Auth to write user/session/account rows during the OAuth flow that Plan 02 exercises.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 6: Verify dev server boots and public archive renders</name>
  <read_first>
    - .planning/phases/01-access-shell/01-UI-SPEC.md (§Public Archive — empty state appearance)
    - .planning/phases/01-access-shell/01-CONTEXT.md (D-04 public route must be reachable without auth)
  </read_first>
  <files>none — human-verify of the dev server boot; no files modified by this task</files>
  <action>Pause execution. Present the boot + browse steps from `<how-to-verify>` to the user. Wait for them to run `npm run dev` and confirm the public archive renders and `/api/auth/session` returns JSON. If the user replies `approved`, mark Plan 01-01b complete. If the user replies `issue: <description>`, halt and surface the issue to the orchestrator for revision planning. (Note: this checkpoint does NOT exercise the OAuth round trip or the `/dashboard` proxy.ts redirect — Plan 02 Task 5 covers those once the header + sign-in button + dashboard page exist.)</action>
  <verify>
    <human-check>User has confirmed `npm run dev` boots cleanly on http://127.0.0.1:3000, the public empty-state page renders at `/`, and `/api/auth/session` returns a JSON response.</human-check>
  </verify>
  <what-built>Plan 01-01b has completed the Walking Skeleton foundation on top of Plan 01-01's scaffold: Drizzle schema with Better Auth tables + role column, Better Auth server config (Spotify provider + first-user-admin hook), proxy.ts route gate, root layout + public empty-state page, and the live SQLite database. This checkpoint verifies the Walking Skeleton boots end-to-end before Plan 02 layers on the OAuth UI.</what-built>
  <how-to-verify>
    1. In a separate terminal, run `npm run dev`.
    2. Wait for the "Ready" line (should mention `http://127.0.0.1:3000`).
    3. In a browser, open `http://127.0.0.1:3000/` (use 127.0.0.1 explicitly, NOT localhost — RESEARCH Pitfall 1).
    4. Confirm you see: a dark page (zinc-950 background) with the heading "No sessions yet" and the body "Sessions will appear here once the archive has been imported. Check back soon." (UI-SPEC §Public Archive). No header is present yet — Plan 02 adds it.
    5. In the same browser, open `http://127.0.0.1:3000/api/auth/session`. Expect a JSON response with `null` or `{"session":null,"user":null}` (proves Better Auth route handler is mounted; not signed in yet so no session).
    6. In the terminal where dev is running, look at the request log — no 500 errors should have occurred.
    7. Stop the dev server with Ctrl+C.
  </how-to-verify>
  <acceptance_criteria>
    - `npm run dev` outputs "Ready" with `http://127.0.0.1:3000` and no error stack
    - Browsing `http://127.0.0.1:3000/` returns 200 and renders the empty-state copy (UI-SPEC line 142-143)
    - Browsing `http://127.0.0.1:3000/api/auth/session` returns 200 with a JSON body (not a 404 or 500)
    - No 500 errors appear in the dev console during these checks
    - User confirms the page appears dark-themed (proves Tailwind v4 + ThemeProvider dark default + zinc-950 background are wired)
  </acceptance_criteria>
  <resume-signal>Reply `approved` to mark Plan 01-01b complete and unblock Plan 02. Reply `issue: <description>` if something is wrong; the executor will diagnose and revise.</resume-signal>
  <done>Walking Skeleton foundation boots end-to-end. Plan 02 can now wire the OAuth UI (header, sign-in/sign-out, dashboard) on top.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Next.js server | Untrusted HTTP requests cross into the server: requests to `/`, `/api/auth/*`, and `/dashboard`. Cookies (including the Better Auth session cookie) are user-controllable. |
| Browser → proxy.ts | Edge runtime gate; receives cookies before any DB access. proxy.ts decides redirect vs continue on `/dashboard/:path*`. |
| Next.js server → Spotify OAuth | Outbound — but the redirect URL Spotify returns to is user-influenceable; the OAuth `state` parameter must be validated. |
| Next.js server → libSQL (local file in Phase 1) | In-process driver, no network boundary in dev. Production crosses the network to Turso. |
| Better Auth `databaseHooks.user.create.after` callback context | A trust point: this callback runs on the server and mutates the user table; its input is the just-created user record from Better Auth, not raw user input — but a bug here can promote the wrong user to admin. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01b-01 | Spoofing | Spotify OAuth callback (`/api/auth/callback/spotify`) | mitigate | Better Auth handles PKCE + state verification automatically (RESEARCH §Don't Hand-Roll). Redirect URI is locked to `http://127.0.0.1:3000/api/auth/callback/spotify` in the Spotify dashboard (Plan 01-01 Task 1 acceptance criteria) — Spotify rejects mismatched redirects. |
| T-01b-02 | Repudiation | First-user-is-admin promotion | accept | Mark always sets up first per CONTEXT.md §Specifics. If the wrong user logs in first, manual SQL UPDATE on `user.role` fixes it — acceptable for a 4-person team. Logged via console.error in the hook (Task 2 action). |
| T-01b-03 | Information Disclosure | Spotify access/refresh tokens stored in `account` table | mitigate | Tokens live in the `account` table server-side only. `account.accessToken`/`refreshToken` columns are never exposed to the browser. Better Auth's session API returns user data without raw provider tokens (RESEARCH §Security Domain). |
| T-01b-04 | Denial of Service | Public `/` route | accept | D-04 mandates an open public route. Phase 1 has no DB read on `/` (pure static empty state). Future caching with `"use cache"` (Phase 3) is the standard mitigation; the `cacheComponents: true` flag is already enabled in `next.config.ts` (Plan 01-01 Task 3) to make that future work zero-cost. |
| T-01b-05 | Elevation of Privilege | Role injection via OAuth profile (user supplies their own `role` field) | mitigate | `user.additionalFields.role` is configured with `input: false` (D-05, Task 2 action) — Better Auth ignores any client-supplied role value. Default is `'member'`. |
| T-01b-06 | Elevation of Privilege | `databaseHooks` callback misuse promoting a non-first user to admin | mitigate | Hook counts existing `user` rows via `SELECT count(*) FROM user` AFTER the row insert; promotes ONLY when count === 1 (D-06). Hook wrapped in try/catch so a hook crash never blocks the sign-in flow (Task 2 action). |
| T-01b-07 | Spoofing | Forged session cookie passes proxy.ts | mitigate | proxy.ts is a presence-only check by design (Edge runtime cannot reach the DB cheaply). The dashboard Server Component (Plan 02) re-validates via `auth.api.getSession` which verifies the cookie signature against `BETTER_AUTH_SECRET`. A forged cookie passes proxy.ts but is rejected by the Server Component → `redirect("/")`. RESEARCH Anti-pattern lines 419-421. |
| T-01b-08 | Spoofing | proxy.ts uses the wrong cookie name and lets ALL `/dashboard` requests through | mitigate | proxy.ts checks BOTH `better-auth.session_token` AND `__Secure-better-auth.session_token`. A dev-mode console log (Task 3) surfaces the actual cookie names so Plan 02's human-verify can catch a mismatch BEFORE relying on proxy.ts in production. The Server Component re-validation is the defense-in-depth fallback. |
</threat_model>

<verification>
- `npx tsc --noEmit` exits with zero `error TS` lines after Tasks 1, 2, 3 (each task's automated check)
- `npm run build` exits 0 after Task 4 (the placeholder page replaced by the real public page still builds)
- `proxy.ts` exists at project root with the correct named export and matcher (Task 3 automated check)
- `local.db` exists at project root with all four tables AND the `role` column with default `'member'` (Task 5 automated check)
- `npm run dev` boots cleanly; `http://127.0.0.1:3000/` returns 200 with the empty-state copy (Task 6 human-verify)
- `http://127.0.0.1:3000/api/auth/session` returns a 200 JSON response (proves Better Auth catch-all route handler is mounted)
</verification>

<success_criteria>
Plan 01-01b is complete when:
1. The Drizzle schema is authored with the four Better Auth tables AND the role column with default 'member' (Task 1).
2. `src/lib/auth.ts` is configured with the Spotify social provider requesting the four D-08 scopes, the `role` additionalField (D-05), and the first-user-is-admin databaseHook (D-06) — all in one file ready for Plan 02 to consume (Task 2).
3. `proxy.ts` exists at project root with the cookie-presence check on `/dashboard/:path*` (Task 3 — moved from Plan 01-02).
4. The public archive empty-state page at `/` renders without any auth check (D-04, ACCESS-04) and shows the exact UI-SPEC copy (Task 4).
5. The local SQLite database has the full schema live (user, session, account, verification) with the role column defaulting to 'member' (Task 5).
6. The dev server boots and the public route is browsable end-to-end at `http://127.0.0.1:3000/` (Task 6 human-verified).

Plan 01-01b satisfies ACCESS-04 (public archive reachable without auth) and partially satisfies ACCESS-01 (the auth handler + Spotify provider are wired; the OAuth round trip itself is exercised by Plan 02). The Walking Skeleton's "one real DB read AND one real write" requirement is fulfilled via the `databaseHooks.user.create.after` callback (set up in Task 2, exercised end-to-end in Plan 02's OAuth flow).
</success_criteria>

<output>
Create `.planning/phases/01-access-shell/01-01b-SUMMARY.md` when done, recording: any deviation from the planned file list, any A1/A2/A5 assumption resolutions (whether `databaseHooks` API matched the assumed shape, whether the drizzle adapter import path was `better-auth/adapters/drizzle` as planned, whether the dev-mode proxy.ts log surfaced the actual cookie name during Task 6's smoke check or whether Plan 02's OAuth verify is needed to resolve A2).
</output>
