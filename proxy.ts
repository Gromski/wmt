import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    // Use next/headers headers(), NOT request.headers — RESEARCH.md Pitfall 3
    // request.headers may not include all cookies; next/headers provides full server context
    headers: await headers(),
  });

  if (!session) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // D-04: matcher gates /dashboard only — public routes (/, /sign-in) intentionally excluded
  matcher: ["/dashboard", "/dashboard/:path*"],
};
