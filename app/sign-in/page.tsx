"use client";

import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = signInSchema.extend({
  name: z.string().min(1).max(80),
});

type Mode = "sign-in" | "sign-up";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Zod validation before network call
    if (mode === "sign-in") {
      const result = signInSchema.safeParse({ email, password });
      if (!result.success) {
        toast.error(
          "Enter a valid email and a password of at least 8 characters.",
        );
        return;
      }
    } else {
      const result = signUpSchema.safeParse({ email, password, name });
      if (!result.success) {
        toast.error(
          "Enter a valid email, a password of at least 8 characters, and your name.",
        );
        return;
      }
    }

    if (mode === "sign-in") {
      await authClient.signIn.email(
        { email, password, callbackURL: "/dashboard" },
        {
          onRequest: () => setIsPending(true),
          onSuccess: () => {
            setIsPending(false); // WR-01: reset before navigation in case push fails
            router.push("/dashboard");
          },
          onError: () => {
            setIsPending(false);
            toast.error(
              "Sign-in failed. Check your email and password and try again.",
            );
          },
        },
      );
    } else {
      await authClient.signUp.email(
        { email, password, name, callbackURL: "/dashboard" },
        {
          onRequest: () => setIsPending(true),
          onSuccess: () => {
            setIsPending(false); // WR-01: reset before navigation in case push fails
            router.push("/dashboard");
          },
          onError: (ctx) => {
            setIsPending(false);
            toast.error(
              ctx.error.message ?? "Sign-up failed. Please try again.",
            );
          },
        },
      );
    }
  }

  const isSignIn = mode === "sign-in";

  return (
    <main className="mx-auto mt-16 max-w-[400px] px-6">
      <Card>
        <CardHeader>
          <CardTitle>{isSignIn ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>
            {isSignIn
              ? "Use the email and password you registered with."
              : "Register so the group can use the dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!isSignIn && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete={isSignIn ? "current-password" : "new-password"}
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <Button
              type="submit"
              variant="default"
              disabled={isPending}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isSignIn ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  {isSignIn ? "Sign in" : "Create account"}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isSignIn ? (
          <>
            Need to register?{" "}
            <button
              type="button"
              onClick={() => setMode("sign-up")}
              className="underline hover:text-foreground transition-colors"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already registered?{" "}
            <button
              type="button"
              onClick={() => setMode("sign-in")}
              className="underline hover:text-foreground transition-colors"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </main>
  );
}
