import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "stampedr_session";

// Everything is freelancer-only except: the homepage, the public receipt
// pages (shareable by design), auth pages/routes, and Next.js internals.
const PUBLIC_PATH_PREFIXES = ["/receipt", "/login", "/signup", "/api/auth", "/_next", "/favicon"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$|.*\\.svg$).*)"],
};
