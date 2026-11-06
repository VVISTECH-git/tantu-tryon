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

const PUBLIC_API = [/^\/api\/two\/tests$/, /^\/api\/auth\//, /^\/api\/poses\//, /^\/api\/products\/\d+$/, /^\/api\/products\/\d+\/(sheet|image)/, /^\/api\/assets\//, /^\/api\/shop\/photos$/, /^\/api\/shop\/combined\/[^/]+$/];

/**
 * tantu-two (8 Oct): the new catalogue-shoot screens, served from public/two
 * when the request comes in on the tantu-two address. Same server, same
 * database and storage as tantu-tryon; only the pages differ. The pages link
 * to each other by file name (tantu-login.html, img/…), so every path on that
 * host that is not an API or Next.js asset is read from /two.
 */
const TWO_HOSTS = (process.env.TWO_HOSTS ?? "tantu-two.vercel.app,two.localhost").split(",").map((h) => h.trim()).filter(Boolean);

function twoHost(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  return TWO_HOSTS.includes(host);
}

/**
 * tantu-two's own site (9 Oct, user: "I don't want to use tantu-tryon"): its pages live in their
 * own project and call this API across sites, signed in with a bearer token, so the API answers
 * those origins (no cookies are sent cross-site, so nothing ambient can be ridden).
 */
const TWO_ORIGINS = (process.env.TWO_ORIGINS ?? "https://tantu-two.vercel.app,http://localhost:5500,http://127.0.0.1:5500").split(",").map((o) => o.trim()).filter(Boolean);

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-tantu-client, x-tantu-device",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin") ?? "";
  if (pathname.startsWith("/api/") && TWO_ORIGINS.includes(origin)) {
    if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
    const signed = /^bearer /i.test(request.headers.get("authorization") ?? "");
    if (!signed && !PUBLIC_API.some((p) => p.test(pathname))) {
      return NextResponse.json({ error: "Sign in to do that." }, { status: 401, headers: corsHeaders(origin) });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
    return res;
  }
  if (twoHost(request) && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/") && !pathname.startsWith("/two/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/two/tantu-landing.html" : `/two${pathname}`;
    return NextResponse.rewrite(url);
  }
  const signedIn = Boolean(request.cookies.get(COOKIE)?.value) || /^bearer /i.test(request.headers.get("authorization") ?? "");

  if (pathname.startsWith("/api/")) {
    if (signedIn || PUBLIC_API.some((p) => p.test(pathname))) return NextResponse.next();
    return NextResponse.json({ error: "Sign in to do that." }, { status: 401 });
  }

  /*
    6 Nov 2026, user: "remove everything else and let us only have a web page
    with these products". The website is now ONE page: /admin/photos (product
    ID and photos), behind sign-in. Every other page goes there. The full site
    is archived in git (tag archive-full-site-2026-11-06). Still open: the
    sign-in screen (/app), share links, and the privacy and support pages the
    App Store listing points to. The phone app only calls /api, untouched.
  */
  const HOME = "/admin/photos";
  if (pathname.startsWith("/share/") || pathname === "/privacy" || pathname === "/support") return NextResponse.next();
  if (signedIn) {
    if (pathname === HOME) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = HOME;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === "/app") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/app";
  url.search = "";
  url.searchParams.set("next", HOME);
  return NextResponse.redirect(url);
}

export const config = {
  // Every page and API; not Next.js files or anything with a file extension (photos, samples, scripts).
  matcher: ["/((?!_next/|.*\\.[A-Za-z0-9]+$).*)"],
};
