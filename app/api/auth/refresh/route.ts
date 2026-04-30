import { NextRequest, NextResponse } from "next/server";
import { buildErrorResponse, refreshAccessToken } from "@/lib/api/server";
import { clearAuthCookies, getAuthTokens, getSessionSnapshotFromCookieStore, setAuthCookies } from "@/lib/auth/session";

type RefreshRequestBody = {
  refreshToken?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RefreshRequestBody | null;
  const currentSnapshot = await getSessionSnapshotFromCookieStore(request.cookies);
  const { refreshToken } = getAuthTokens(request.cookies);
  const nextRefreshToken = body?.refreshToken || refreshToken;

  if (!nextRefreshToken) {
    return buildErrorResponse("No refresh token is available.", 401);
  }

  const refreshed = await refreshAccessToken(nextRefreshToken, currentSnapshot);

  if (!refreshed) {
    const response = buildErrorResponse("Your session has expired. Please sign in again.", 401);
    clearAuthCookies(response.cookies);
    return response;
  }

  const response = NextResponse.json({ ...refreshed.payload, permissions: refreshed.permissions });
  await setAuthCookies(response.cookies, refreshed.payload, refreshed.permissions);
  return response;
}
