import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DRIVER_ROUTES  = ["/monitor", "/dashboard", "/sessions", "/driver"];
const INSURER_ROUTES = ["/insurer"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("drowsy_token")?.value;
  const role  = request.cookies.get("drowsy_role")?.value;

  const isDriverRoute  = DRIVER_ROUTES.some((p) => pathname.startsWith(p));
  const isInsurerRoute = INSURER_ROUTES.some((p) => pathname.startsWith(p));

  /* Already authenticated — bounce away from /login */
  if (pathname === "/login" && token) {
    return NextResponse.redirect(
      new URL(role === "insurer" ? "/insurer" : "/dashboard", request.url)
    );
  }

  /* Protected — require any token */
  if ((isDriverRoute || isInsurerRoute) && !token) {
    const dest = new URL("/login", request.url);
    dest.searchParams.set("from", pathname);
    return NextResponse.redirect(dest);
  }

  /* Insurer-only routes — require insurer or admin role */
  if (isInsurerRoute && token && role !== "insurer" && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/monitor/:path*",
    "/dashboard/:path*",
    "/sessions/:path*",
    "/driver/:path*",
    "/insurer/:path*",
    "/settings/:path*",
  ],
};
