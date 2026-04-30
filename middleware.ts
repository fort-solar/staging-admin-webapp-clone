import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDefaultDashboardPath, getUsersLandingPath, isDashboardPath, isPathAllowed, normalizeAdminRole } from "@/lib/auth/access-control";
import { getSessionSnapshotFromCookieStore, isAdminSnapshot } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const snapshot = await getSessionSnapshotFromCookieStore(request.cookies);
  const isAuthenticatedAdmin = isAdminSnapshot(snapshot);

  if (pathname === "/") {
    const redirectTo = isAuthenticatedAdmin
      ? getDefaultDashboardPath(normalizeAdminRole(snapshot!.session.adminRole), snapshot!.permissions)
      : "/login";

    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (pathname === "/login") {
    if (isAuthenticatedAdmin) {
      const redirectTo = getDefaultDashboardPath(normalizeAdminRole(snapshot!.session.adminRole), snapshot!.permissions);
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    return NextResponse.next();
  }

  if (!isDashboardPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthenticatedAdmin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = normalizeAdminRole(snapshot!.session.adminRole);

  if (pathname === "/users") {
    const redirectTo = getUsersLandingPath(role, snapshot!.permissions) ?? getDefaultDashboardPath(role, snapshot!.permissions);
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (!isPathAllowed(pathname, role, snapshot!.permissions)) {
    const redirectTo = getDefaultDashboardPath(role, snapshot!.permissions);
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
