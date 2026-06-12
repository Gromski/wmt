"use client";

import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function getInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).slice(0, 2);
  return tokens.map((t) => t[0]?.toUpperCase() ?? "").join("");
}

export function GlobalHeader() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push("/sign-in") },
    });
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-card border-b border-border h-14">
      <div className="mx-auto flex h-full max-w-[1080px] items-center justify-between px-6">
        <Link href="/" className="text-xl font-semibold">
          Warwick Massive Tunage
        </Link>

        <nav className="flex items-center gap-3">
          {!isPending && !session && (
            <Button
              asChild
              variant="default"
              size="sm"
              className="min-h-[44px]"
            >
              <Link href="/sign-in">
                <LogIn className="h-4 w-4 mr-2" />
                Sign in
              </Link>
            </Button>
          )}

          {!isPending && session && (
            <>
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {getInitials(session.user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{session.user.name}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
