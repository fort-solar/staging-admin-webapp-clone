import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FORTSOLAR_API_BASE_URL, buildErrorResponse } from "@/lib/api/server";
import { getAuthTokens, getSessionSnapshotFromCookieStore, isAdminSnapshot } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const snapshot = await getSessionSnapshotFromCookieStore(cookieStore);
  const { accessToken } = getAuthTokens(cookieStore);

  if (!snapshot || !isAdminSnapshot(snapshot) || !accessToken) {
    return buildErrorResponse("Please sign in to continue.", 401);
  }

  const socketUrl = process.env.FORTSOLAR_SOCKET_URL ?? process.env.NEXT_PUBLIC_FORTSOLAR_SOCKET_URL ?? FORTSOLAR_API_BASE_URL;
  const configuredEvents = process.env.NEXT_PUBLIC_FORTSOLAR_NOTIFICATION_EVENTS ?? process.env.FORTSOLAR_NOTIFICATION_EVENTS ?? "admin:notification,notification,notification:new";
  const eventNames = configuredEvents
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return NextResponse.json({
    success: true,
    data: {
      accessToken,
      socketUrl,
      eventNames,
    },
  });
}
