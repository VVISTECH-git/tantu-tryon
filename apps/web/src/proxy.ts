import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/session";

/**
 * The first door, not the only one.
 *
 * This only checks that a session cookie is present: the proxy cannot ask the
 * database whether it is still valid, and it never sees a Server Action or a
 * fetch the same way it sees a navigation. Every route handler and page
 * behind it calls `requireAccount()` itself. What this buys is a clean
 * redirect to the sign-in screen for pages, and a 401 rather than a stack
 * trace for API calls made without signing in.
 */

const PUBLIC_API = [/^\/api\/auth\//, /^\/api\/poses\//, /^\/api\/products\/\d+$/, /^\/api\/products\/\d+\/(sheet|image)/, /^\/api\/assets\//];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(COOKIE)?.value);
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some((p) => p.test(pathname))) return NextResponse.next();
    return NextResponse.json({ error: "Sign in to do that." }, { status: 401 });
  }

  // /app itself is the sign-in screen; everything under it needs a session.
  if (pathname === "/app") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/app";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/studio", "/library", "/api/:path*"],
};
