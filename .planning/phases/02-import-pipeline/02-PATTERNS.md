# Phase 2: Import Pipeline - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/import/route.ts` | route (SSE) | streaming | `app/api/import/route.ts` (Phase 1 stub) | exact — replace stub |
| `app/api/apple-token/route.ts` | route | request-response | `app/api/import/route.ts` | role-match (same auth gate, GET not POST) |
| `app/api/sessions/[id]/route.ts` | route | CRUD | `app/api/import/route.ts` | role-match (same auth gate, PATCH) |
| `lib/apple-dev-token.ts` | utility | transform | `lib/utils.ts` | role-match (server-only utility) |
| `db/schema.ts` | schema (extend) | — | `db/schema.ts` | exact — extend existing file |
| `components/ImportTriggerCard.tsx` | component (replace) | event-driven | `components/ImportTriggerCard.tsx` (Phase 1) | exact — extend existing |
| `components/AttributionErrorCard.tsx` | component | request-response | `components/ImportTriggerCard.tsx` | role-match (Card layout, shadcn primitives) |
| `components/SessionDateTable.tsx` | component | CRUD | `app/sign-in/page.tsx` | role-match (controlled inputs, blur/save, toast) |
| `app/dashboard/page.tsx` | page (extend) | request-response | `app/dashboard/page.tsx` (Phase 1) | exact — extend existing |
| `types/musickit.d.ts` | type declaration | — | `lib/utils.ts` | partial (global augmentation, no direct analog) |

---

## Pattern Assignments

### `app/api/import/route.ts` (route, streaming — replace stub)

**Analog:** `app/api/import/route.ts` (Phase 1 stub, lines 1–18)

The Phase 1 stub already contains the canonical auth-gate pattern. Phase 2 replaces everything after the 403 gate with SSE streaming logic.

**Imports pattern** (lines 1–2):
```typescript
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
```

**Auth gate pattern** (lines 4–13) — preserve exactly:
```typescript
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  // ... replace everything below this line
}
```

**SSE streaming response pattern** (from RESEARCH.md Pattern 6 — no existing analog in codebase):
```typescript
export const maxDuration = 300;

export async function POST(request: Request) {
  // ... auth gate above ...
  const { musicUserToken } = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // ... import logic, calling send() for each progress event ...
        send({ type: "complete", sessions: 31, tracks: 496 });
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Error handling:** All errors caught inside the `ReadableStream.start()` callback; send `{ type: "error", message }` SSE event then let `finally` close the controller. Do NOT throw from inside `start()` — it silently swallows.

---

### `app/api/apple-token/route.ts` (route, request-response)

**Analog:** `app/api/import/route.ts` (Phase 1 stub)

Same auth gate, but a GET handler that returns a JSON body containing the short-lived developer JWT.

**Full pattern:**
```typescript
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateAppleDeveloperToken } from "@/lib/apple-dev-token";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const token = await generateAppleDeveloperToken();
    return Response.json({ token });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Token generation failed" },
      { status: 500 },
    );
  }
}
```

---

### `app/api/sessions/[id]/route.ts` (route, CRUD)

**Analog:** `app/api/import/route.ts` (Phase 1 stub)

Same auth gate structure. PATCH handler accepts `{ date: string }` and updates the `sessions.date` column.

**Auth gate pattern** — copy verbatim from import route (lines 1–13).

**PATCH body + Drizzle update pattern:**
```typescript
import { db } from "@/lib/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ... auth gate (session check → 401, role check → 403) ...

  const { id } = await params;
  const { date } = await request.json();

  // Validate and coerce date string to timestamp_ms integer
  const ts = date ? new Date(date).getTime() : null;
  if (date && isNaN(ts!)) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  await db
    .update(schema.sessions)
    .set({ date: ts })
    .where(eq(schema.sessions.id, Number(id)));

  return Response.json({ ok: true });
}
```

---

### `lib/apple-dev-token.ts` (utility, transform — server-only)

**Analog:** `lib/utils.ts` (lines 1–17) — same pattern: named export pure function, no side effects, no imports from `lib/auth.ts` or `lib/db.ts`.

**Imports pattern** (mirrors `lib/utils.ts` style — external module first, then internal):
```typescript
import { createPrivateKey } from "crypto";
import { SignJWT } from "jose";
```

**Core pattern** (from RESEARCH.md Pattern 1):
```typescript
export async function generateAppleDeveloperToken(): Promise<string> {
  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!rawKey) throw new Error("APPLE_PRIVATE_KEY env var is not set");

  // .replace(/\\n/g, "\n") is critical: env vars store \n as literal two chars
  const privateKey = createPrivateKey(rawKey.replace(/\\n/g, "\n"));

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}
```

**Guard:** Add the same startup-assertion style used in `lib/auth.ts` (lines 9–14): validate all three env vars (`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`) and throw descriptive errors rather than letting `crypto` throw cryptic PEM errors.

---

### `db/schema.ts` (schema extension — existing file)

**Analog:** `db/schema.ts` (lines 1–85) — existing file, append new tables below the `verification` table.

**Column conventions to copy** (from existing tables):
```typescript
// integer primary key (auto-increment variant)
id: integer("id").primaryKey({ autoIncrement: true }),

// text primary key (Better Auth style — NOT used for new app tables)
id: text("id").primaryKey(),

// foreign key with cascade
sessionId: integer("session_id")
  .notNull()
  .references(() => sessions.id, { onDelete: "cascade" }),

// nullable timestamp_ms
date: integer("date", { mode: "timestamp_ms" }),

// boolean stored as integer
attributionParsed: integer("attribution_parsed", { mode: "boolean" })
  .notNull()
  .default(true),

// text enum
role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
```

**Import pattern** (line 1 — `sql` already imported, use it for defaults if needed):
```typescript
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
```

New tables (`sessions`, `contributors`, `tracks`, `sessionTracks`, `artistTags`) follow the schema from RESEARCH.md Code Examples verbatim — these are canonical and match the established column conventions above.

---

### `components/ImportTriggerCard.tsx` (component, event-driven — replace Phase 1)

**Analog:** `components/ImportTriggerCard.tsx` (Phase 1, lines 1–72) — replace in place.

**Imports pattern** (lines 1–13 of Phase 1):
```typescript
"use client";

import { Loader2, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
```
Add to imports: `Script` from `next/script`, `useRef` from `react`, `AlertCircle`, `Check` from `lucide-react`.

**State pattern** — mirror Phase 1 `useState(false)` for `isRunning`; extend with:
```typescript
const [progress, setProgress] = useState<{ stage: string; current: number; total: number } | null>(null);
const [musicKitReady, setMusicKitReady] = useState(false);
```

**Button disabled/aria-busy pattern** (lines 52–68) — preserve exactly:
```typescript
<Button
  variant="default"
  size="default"
  disabled={isRunning}
  onClick={handleStart}
  aria-busy={isRunning}
>
  {isRunning ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Importing…
    </>
  ) : ( ... )}
</Button>
```

**Toast error codes** (lines 25–37) — copy the 401/403/generic pattern exactly; add new cases for SSE `type: "error"` events.

**SSE client reader pattern** (from RESEARCH.md Pattern 6 — no codebase analog):
```typescript
const res = await fetch("/api/import", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ musicUserToken }),
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  for (const line of decoder.decode(value).split("\n")) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6));
      // Update React state: progress, status text, completion summary
    }
  }
}
```

**Script tag pattern for MusicKit JS v3:**
```tsx
<Script
  src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"
  strategy="afterInteractive"
  onLoad={() => setMusicKitReady(true)}
/>
```

---

### `components/AttributionErrorCard.tsx` (component, request-response)

**Analog:** `components/ImportTriggerCard.tsx` (Phase 1, lines 40–71) — same Card layout, same shadcn primitives.

**Imports pattern** (mirror ImportTriggerCard, swap icons):
```typescript
"use client";

import { AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
```

**Card layout pattern** (lines 41–70 of ImportTriggerCard):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Attribution errors</CardTitle>
    <CardDescription>
      Sessions where contributor order could not be parsed automatically.
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* slot-based assignment UI per session */}
  </CardContent>
</Card>
```

**Props pattern** — receives pre-fetched data from Server Component (parent `dashboard/page.tsx`) as props; does not fetch on its own. Follow the same pattern as `ImportTriggerCard` receiving no async deps.

**Slot dropdown** — use native `<select>` with the same Tailwind input class as `app/sign-in/page.tsx` (line 123):
```typescript
className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

---

### `components/SessionDateTable.tsx` (component, CRUD)

**Analog:** `app/sign-in/page.tsx` — controlled input pattern (lines 112–156), onBlur save, toast feedback.

**Imports pattern:**
```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
```

**Controlled input + blur-save pattern** (mirror sign-in lines 116–142):
```typescript
// Per-row state: { [sessionId]: string }
const [dates, setDates] = useState<Record<number, string>>(initialDates);

async function handleDateBlur(sessionId: number) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dates[sessionId] }),
    });
    if (!res.ok) {
      toast.error("Failed to save date. Please try again.");
    }
  } catch {
    toast.error("Could not reach the server.");
  }
}

<input
  type="date"
  value={dates[session.id] ?? ""}
  onChange={(e) => setDates((prev) => ({ ...prev, [session.id]: e.target.value }))}
  onBlur={() => handleDateBlur(session.id)}
  onKeyDown={(e) => e.key === "Enter" && handleDateBlur(session.id)}
  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
/>
```

**Error toast pattern** — copy from `DashboardSignOut.tsx` (line 18): `toast.error("...")` with a specific user-facing message; never expose raw error details.

---

### `app/dashboard/page.tsx` (page extension — existing file)

**Analog:** `app/dashboard/page.tsx` (Phase 1, lines 1–56) — extend in place.

**Session gate pattern** (lines 11–16) — preserve exactly:
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/sign-in");
```

**isAdmin gate for admin-only sections** (lines 17, 45–49) — preserve exactly:
```typescript
const isAdmin = session.user.role === "admin";
// ...
{isAdmin && (
  <section className="mt-8">
    <ImportTriggerCard />
  </section>
)}
```

**Server Component DB read pattern** — add Drizzle query for sessions and attribution errors above the return, parallel to existing session fetch:
```typescript
import { db } from "@/lib/db";
import * as schema from "@/db/schema";
// ...
const sessions = await db.select().from(schema.sessions).orderBy(schema.sessions.sessionNumber);
const attributionErrors = sessions.filter((s) => !s.attributionParsed);
```

**Layout** — follow `mx-auto max-w-[640px] px-6` container (line 22) and `Separator` between sections (line 43).

---

### `types/musickit.d.ts` (type declaration)

**No direct analog** — this is a global type augmentation. No existing `.d.ts` files in the project.

**Pattern from RESEARCH.md Pitfall 3 — use exactly:**
```typescript
// types/musickit.d.ts
declare global {
  interface Window {
    MusicKit: {
      configure(config: {
        developerToken: string;
        app: { name: string; build: string };
      }): void;
      getInstance(): {
        authorize(): Promise<string>;
        isAuthorized: boolean;
      };
    };
  }
}
export {};
```

---

## Shared Patterns

### Auth Gate (session check → 401, role check → 403)
**Source:** `app/api/import/route.ts` lines 1–13
**Apply to:** `app/api/import/route.ts`, `app/api/apple-token/route.ts`, `app/api/sessions/[id]/route.ts`
```typescript
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const session = await auth.api.getSession({ headers: await headers() });
if (!session) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
if (session.user.role !== "admin") {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
```

### Toast Error Codes (client-side API call handling)
**Source:** `components/ImportTriggerCard.tsx` lines 23–38
**Apply to:** `components/ImportTriggerCard.tsx` (replace), `components/SessionDateTable.tsx`, `components/AttributionErrorCard.tsx`
```typescript
if (res.status === 401) {
  toast.error("Your session expired. Please sign in again.");
} else if (res.status === 403) {
  toast.error("Only admins can trigger imports.");
} else {
  toast.error(body.error ?? `Request failed (${res.status}).`);
}
```

### Drizzle Column Conventions
**Source:** `db/schema.ts` lines 1–85
**Apply to:** `db/schema.ts` (new tables appended to this file)
- Integer PK with autoIncrement: `integer("id").primaryKey({ autoIncrement: true })`
- Foreign key: `.references(() => table.id, { onDelete: "cascade" })`
- Boolean: `integer("col", { mode: "boolean" })`
- Timestamp: `integer("col", { mode: "timestamp_ms" })`
- No `sql` default needed for app tables (only Better Auth managed tables use `sql` defaults)

### Tailwind Input Class
**Source:** `app/sign-in/page.tsx` line 123
**Apply to:** `components/SessionDateTable.tsx`, `components/AttributionErrorCard.tsx` (slot dropdowns)
```typescript
className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### Card Layout (shadcn)
**Source:** `components/ImportTriggerCard.tsx` lines 41–70
**Apply to:** `components/AttributionErrorCard.tsx`
```tsx
<Card>
  <CardHeader>
    <CardTitle>...</CardTitle>
    <CardDescription>...</CardDescription>
  </CardHeader>
  <CardContent>
    ...
  </CardContent>
</Card>
```

### Env Var Assertion at Module Load
**Source:** `lib/auth.ts` lines 9–14 (BETTER_AUTH_SECRET check)
**Apply to:** `lib/apple-dev-token.ts`
```typescript
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret === "replace-me") {
  throw new Error("BETTER_AUTH_SECRET is not configured. ...");
}
```
Mirror this pattern for `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` in `generateAppleDeveloperToken()`.

### Disabled Button with aria-busy + Loader2 Spinner
**Source:** `components/ImportTriggerCard.tsx` lines 52–68
**Apply to:** `components/ImportTriggerCard.tsx` (replace — preserve this sub-pattern)
```tsx
<Button disabled={isRunning} onClick={handleStart} aria-busy={isRunning}>
  {isRunning ? (
    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>
  ) : (
    <><Play className="h-4 w-4 mr-2" />Start import</>
  )}
</Button>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `types/musickit.d.ts` | type declaration | — | No `.d.ts` files exist in the project; pattern sourced from RESEARCH.md Pitfall 3 |

All other files have close analogs in the Phase 1 codebase.

---

## Metadata

**Analog search scope:** `app/`, `components/`, `lib/`, `db/`, `proxy.ts`
**Files scanned:** 22 TypeScript/TSX files
**Pattern extraction date:** 2026-06-12
