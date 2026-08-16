import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Edge-safe optimistic gate. Netlify runs this middleware on the Edge runtime,
// which forbids native C++ addons — so we must NOT import @/lib/auth (it pulls
// in lib/db → @libsql/client's native addon). Instead do a DB-free check for
// the presence of the Better Auth session cookie; full session validation
// happens in the /dashboard server component, which redirects to /sign-in when
// the session is actually invalid (defence in depth preserved).
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // D-04: matcher gates /dashboard only — public routes (/, /sign-in) intentionally excluded
  matcher: ["/dashboard", "/dashboard/:path*"],
};
