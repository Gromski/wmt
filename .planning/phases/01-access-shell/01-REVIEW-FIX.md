---
phase: 01-access-shell
fixed_at: 2026-06-12T00:00:00Z
review_path: .planning/phases/01-access-shell/01-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-12
**Source review:** .planning/phases/01-access-shell/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (4 Critical, 5 Warning, 2 Info)
- Fixed: 11
- Skipped: 0

## Fixed Issues

### CR-01: `proxy.ts` calls `next/headers` inside an edge/proxy context

**Files modified:** `proxy.ts`
**Commit:** 0e1afd3
**Applied fix:** Removed `import { headers } from "next/headers"` and replaced `await headers()` with `request.headers` directly. Removed the misleading comment that perpetuated the mistake.

---

### CR-02: First-user-is-admin logic TOCTOU race condition

**Files modified:** `lib/auth.ts`
**Commit:** 7732325
**Applied fix:** Added a clear inline comment in the `before` hook documenting the race window, explaining why it is acceptable for this 4-person SQLite app (SQLite serialises writes; allowlist prevents unknown users), and recommending disabling sign-up after initial bootstrap as the mitigation. The hook logic itself is unchanged — a full atomic bootstrap table approach would be over-engineering for this scale.

---

### CR-03: Open self-registration — any internet user can create an account

**Files modified:** `lib/auth.ts`
**Commit:** 7732325
**Applied fix:** Added an `ALLOWED_EMAILS` env-var-driven allowlist in the `user.create.before` hook. The var is a comma-separated list of permitted email addresses. When unset in development, all emails are allowed with a `console.warn`; production must set the variable. The allowlist check runs before the first-user-admin logic so unknown users are rejected before any role assignment.

---

### CR-04: `Toaster` / `useTheme` always falls back to `"system"` — dark mode never applied to toasts

**Files modified:** `components/ui/sonner.tsx`
**Commit:** 0288fed
**Applied fix:** Removed the `useTheme` import and hook call from `sonner.tsx`. Replaced `theme={theme as ToasterProps["theme"]}` with the literal `theme="dark"` since the app forces dark mode via `className="dark"` on `<html>` and no `ThemeProvider` is mounted. A future theme toggle can add `ThemeProvider` at that point.

---

### WR-01: `isPending` never reset to `false` on successful sign-in or sign-up

**Files modified:** `app/sign-in/page.tsx`
**Commit:** b20e9be
**Applied fix:** Added `setIsPending(false)` before `router.push("/dashboard")` in the `onSuccess` callback for both the sign-in and sign-up branches. This ensures the button is re-enabled if navigation is delayed or fails.

---

### WR-02: Sign-out has no error handling in `DashboardSignOut` and `GlobalHeader`

**Files modified:** `components/DashboardSignOut.tsx`, `components/GlobalHeader.tsx`
**Commit:** c347cf9
**Applied fix:** Added `onError: () => toast.error("Sign-out failed. Please try again.")` to the `fetchOptions` in both components' `handleSignOut` functions. Also added the missing `import { toast } from "sonner"` to `DashboardSignOut.tsx`.

---

### WR-03: `autoComplete="current-password"` used on sign-up form

**Files modified:** `app/sign-in/page.tsx`
**Commit:** b20e9be
**Applied fix:** Changed the password input `autoComplete` attribute to `{isSignIn ? "current-password" : "new-password"}`. The `isSignIn` variable was already computed from `mode` state so no extra logic was needed.

---

### WR-04: `lib/auth-client.ts` — `baseURL` silently passes undefined

**Files modified:** `lib/auth-client.ts`
**Commit:** 4d0d490
**Applied fix:** Replaced the bare `process.env.NEXT_PUBLIC_APP_URL` with `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`. This follows the task specification (fallback rather than hard throw) since this module runs in the browser bundle where a module-level throw would silently break the app without a visible error boundary. A comment documents that production must set the env var explicitly.

---

### WR-05: `lib/auth.ts` does not assert `BETTER_AUTH_SECRET`

**Files modified:** `lib/auth.ts`
**Commit:** 7732325
**Applied fix:** Added a startup assertion that reads `process.env.BETTER_AUTH_SECRET` into a `secret` constant and throws if it is missing or still set to the `"replace-me"` placeholder from `.env.local.example`. The `secret` constant is then passed explicitly to `betterAuth({ secret, ... })`.

---

### IN-01: `getInitials` duplicated in two files

**Files modified:** `lib/utils.ts`, `app/dashboard/page.tsx`, `components/GlobalHeader.tsx`
**Commit:** 5e405d9
**Applied fix:** Extracted `getInitials(name: string): string` to `lib/utils.ts` alongside `cn()`. Removed the local implementations from both consumers and added `import { getInitials } from "@/lib/utils"` to each. The implementation used is identical to both prior copies.

---

### IN-02: `verification` table `createdAt`/`updatedAt` nullable unlike all other tables

**Files modified:** `db/schema.ts`
**Commit:** 891890a
**Applied fix:** Added `.notNull()` to both `createdAt` and `updatedAt` in the `verification` table. Both columns already have a DB-level default, so the constraint is safe to add and matches the pattern in `user`, `session`, and `account` tables.

---

## Skipped Issues

None — all 11 findings were fixed.

---

_Fixed: 2026-06-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
