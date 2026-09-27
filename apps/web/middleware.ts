import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Keep the fast path friendly while the server layouts validate each token
 * against FastAPI. A cookie is only an entry check, never authorization.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") {
    const headers = new Headers(request.headers);
    headers.set("x-subgate-public-auth", "1");
    return NextResponse.next({ request: { headers } });
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !request.cookies.has("subgate_admin_session")) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (pathname.startsWith("/dashboard") && !request.cookies.has("subgate_creator_session")) {
    const login = new URL("/creator/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
