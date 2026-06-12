import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";

// WR-05: Assert BETTER_AUTH_SECRET at startup so a missing/placeholder value
// fails loudly rather than silently signing sessions with a weak secret.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret === "replace-me") {
  throw new Error(
    "BETTER_AUTH_SECRET is not configured. Set a strong random value in .env.local.",
  );
}

// CR-03: Email allowlist — only the four known contributors can register.
// Set ALLOWED_EMAILS in the environment as a comma-separated list.
// In development, if the variable is unset, all emails are allowed (with a
// warning) so initial scaffolding works without env setup. Production MUST
// set this variable.
const rawAllowedEmails = process.env.ALLOWED_EMAILS;
const allowedEmails: Set<string> | null = rawAllowedEmails
  ? new Set(rawAllowedEmails.split(",").map((e) => e.trim().toLowerCase()))
  : null;

if (!rawAllowedEmails) {
  console.warn(
    "[auth] ALLOWED_EMAILS is not set — all email addresses can register. " +
      "Set ALLOWED_EMAILS in production to restrict sign-ups to known contributors.",
  );
}

export const auth = betterAuth({
  secret,
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
        input: false, // users cannot set their own role on signup (security: role escalation — T-01b-02)
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // MUST be `before` hook — `after` cannot return modified data atomically (RESEARCH.md Pitfall 1)
        before: async (user) => {
          // CR-03: Reject registrations not on the email allowlist.
          if (allowedEmails && !allowedEmails.has(user.email.toLowerCase())) {
            throw new Error("Registration is by invitation only.");
          }

          // First-user-is-admin rule (D-06).
          // Count existing users to detect first registration.
          // CR-02: This count-then-insert pattern has a TOCTOU race window:
          // two concurrent sign-up requests can both read count=0 and both
          // become admin. For this 4-person private app the risk is negligible
          // (SQLite serialises writes and the allowlist prevents unknown users).
          // Recommended mitigation after initial bootstrap: set ALLOWED_EMAILS
          // and remove the sign-up UI so no new accounts can be created.
          const result = (await db
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
