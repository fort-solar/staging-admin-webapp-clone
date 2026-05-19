import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildErrorResponse } from "@/lib/api/server";
import { readNonEmptyEnv } from "@/lib/env";
import { getAuthTokens, getSessionSnapshotFromCookieStore, isAdminSnapshot } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const snapshot = await getSessionSnapshotFromCookieStore(cookieStore);
  const { accessToken } = getAuthTokens(cookieStore);

  if (!snapshot || !isAdminSnapshot(snapshot) || !accessToken) {
    return buildErrorResponse("Please sign in to continue.", 401);
  }

  const socketUrl = readNonEmptyEnv(
    process.env.FORTSOLAR_SOCKET_URL,
    process.env.NEXT_PUBLIC_FORTSOLAR_SOCKET_URL,
    process.env.FORTSOLAR_API_BASE_URL,
    process.env.NEXT_PUBLIC_FORTSOLAR_API_BASE_URL,
  );
  const socketPath = readNonEmptyEnv(process.env.FORTSOLAR_SOCKET_PATH, process.env.NEXT_PUBLIC_FORTSOLAR_SOCKET_PATH) ?? "/socket.io";
  const configuredEvents =
    readNonEmptyEnv(process.env.FORTSOLAR_NOTIFICATION_EVENTS, process.env.NEXT_PUBLIC_FORTSOLAR_NOTIFICATION_EVENTS) ??
    "admin:notification,notification,notification:new";

  if (!socketUrl) {
    return buildErrorResponse("Socket URL is not configured.", 500);
  }

  const eventNames = configuredEvents
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return NextResponse.json({
    success: true,
    data: {
      accessToken,
      socketUrl,
      socketPath,
      eventNames,
    },
  });
}
