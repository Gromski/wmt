import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    // request.headers IS the full header set in proxy/middleware context —
    // next/headers is not available in this runtime (edge-compatible proxy layer)
    headers: request.headers,
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
