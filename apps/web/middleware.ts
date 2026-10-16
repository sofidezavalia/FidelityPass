import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE_NAME } from "./lib/staff-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Protección de rutas de empleado (/empleado/escanear)
  if (pathname.startsWith("/empleado/escanear")) {
    const staffCookie = request.cookies.get(STAFF_COOKIE_NAME)?.value;
    if (!staffCookie) {
      return NextResponse.redirect(new URL("/empleado/login", request.url));
    }
    return NextResponse.next();
  }

  // 2. Protección de rutas del panel de comercio (/panel)
  if (pathname.startsWith("/panel")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/panel",
    "/panel/:path*",
    "/empleado/escanear",
    "/empleado/escanear/:path*",
  ],
};
