import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";

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
        input: false, // users cannot set their own role on signup (security: role escalation — T-01b-02)
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // MUST be `before` hook — `after` cannot return modified data atomically (RESEARCH.md Pitfall 1)
        before: async (user) => {
          // First-user-is-admin rule (D-06).
          // Count existing users to detect first registration.
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
